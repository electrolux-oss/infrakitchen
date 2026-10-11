from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from kubernetes_asyncio.client.exceptions import ApiException

from application.worker_templates.model import WorkerTemplateDTO
from application.worker_templates.providers import get_worker_provider
from application.worker_templates.providers.base import MANAGED_BY_LABEL, TEMPLATE_LABEL, WorkerInstance
import application.worker_templates.providers.kubernetes as k8s_mod
from application.worker_templates.providers.kubernetes import (
    BackendContainer,
    KubernetesUnavailable,
    KubernetesWorkerProvider,
    build_pod,
    get_backend_container,
    pod_name_prefix,
    pod_to_instance,
)

MANIFEST = """
apiVersion: v1
kind: Pod
metadata:
  name: fixed-name
  namespace: other
  labels:
    team: platform
spec:
  hostname: custom
  restartPolicy: Always
  containers:
    - name: worker
      image: ik:latest
      env:
        - name: WORKER_IDLE_EXIT_SECONDS
          value: "0"
        - name: POSTGRES_HOST
          value: db
    - name: sidecar
      image: busybox
"""


@pytest.fixture
def template(mocked_worker_template) -> WorkerTemplateDTO:
    mocked_worker_template.configuration = {"provider": "kubernetes", "pod_manifest": MANIFEST, "namespace": "ik"}
    mocked_worker_template.name = "Big Workers!"
    return WorkerTemplateDTO.model_validate(mocked_worker_template)


BACKEND_POD = {
    "spec": {
        "containers": [
            {"name": "proxy", "image": "envoy", "env": [{"name": "PORT", "value": "1"}]},
            {
                "name": "infrakitchen-scheduler",
                "image": "ik:1.2.3",
                "env": [
                    {"name": "POSTGRES_HOST", "value": "db.internal"},
                    {
                        "name": "POSTGRES_PASSWORD",
                        "valueFrom": {"secretKeyRef": {"name": "infrakitchen-secrets", "key": "postgres-password"}},
                    },
                    {"name": "WORKER_AUTOSCALER_ENABLED", "value": "true"},
                    {"name": "WORKER_IDLE_EXIT_SECONDS", "value": "0"},
                ],
                "envFrom": [{"configMapRef": {"name": "infrakitchen-config"}}],
            },
        ]
    }
}


@pytest.fixture(autouse=True)
def reset_backend_cache(monkeypatch):
    monkeypatch.setattr(k8s_mod, "_backend_container", None)
    monkeypatch.setattr(k8s_mod, "incluster_namespace", lambda: "infrakitchen")
    monkeypatch.setattr(k8s_mod.socket, "gethostname", lambda: "infrakitchen-scheduler-abc")


@pytest.fixture
def client():
    client = Mock()
    client.read_namespaced_pod = AsyncMock(return_value=BACKEND_POD)
    client.create_namespaced_pod = AsyncMock()
    client.list_labeled_pods = AsyncMock()
    client.delete_namespaced_pod = AsyncMock()
    return client


def make_pod(name: str, phase: str | None):
    return SimpleNamespace(
        metadata=SimpleNamespace(
            name=name,
            namespace="ik",
            creation_timestamp=datetime(2026, 1, 1, tzinfo=UTC),
            deletion_timestamp=None,
        ),
        spec=SimpleNamespace(node_name="node-1"),
        status=SimpleNamespace(phase=phase, reason=None, message=None) if phase else None,
    )


class TestBuildPod:
    def test_pod_body(self, template):
        pod = build_pod(template, template.configuration, {"WORKER_IDLE_EXIT_SECONDS": "300", "WORKER_NAME": "w"})

        metadata = pod["metadata"]
        assert "name" not in metadata
        assert "namespace" not in metadata
        assert metadata["generateName"] == "ik-worker-big-workers-"
        assert metadata["labels"] == {
            "team": "platform",
            MANAGED_BY_LABEL: "infrakitchen",
            TEMPLATE_LABEL: str(template.id),
        }
        assert pod["spec"]["restartPolicy"] == "Never"
        assert "hostname" not in pod["spec"]

        env = pod["spec"]["containers"][0]["env"]
        assert env == [
            {"name": "POSTGRES_HOST", "value": "db"},
            {"name": "WORKER_IDLE_EXIT_SECONDS", "value": "300"},
            {"name": "WORKER_NAME", "value": "w"},
        ]
        assert pod["spec"]["containers"][1]["env"][0] == {"name": "WORKER_IDLE_EXIT_SECONDS", "value": "300"}

    def test_inherits_backend_settings(self, mocked_worker_template):
        mocked_worker_template.configuration = {
            "provider": "kubernetes",
            "pod_manifest": (
                "kind: Pod\nspec:\n  containers:\n"
                "    - name: worker\n      env:\n        - {name: POSTGRES_HOST, value: pgbouncer}\n"
                "    - name: sidecar\n      image: busybox\n"
            ),
        }
        template = WorkerTemplateDTO.model_validate(mocked_worker_template)
        backend = BackendContainer(
            image="ik:1.2.3",
            env=[
                {"name": "POSTGRES_HOST", "value": "db.internal"},
                {"name": "JWT_KEY", "valueFrom": {"secretKeyRef": {"name": "s", "key": "jwt"}}},
            ],
            env_from=[{"configMapRef": {"name": "infrakitchen-config"}}],
        )

        pod = build_pod(template, template.configuration, {"WORKER_NAME": "w"}, backend)

        worker, sidecar = pod["spec"]["containers"]
        assert worker["image"] == "ik:1.2.3"
        assert worker["env"] == [
            {"name": "JWT_KEY", "valueFrom": {"secretKeyRef": {"name": "s", "key": "jwt"}}},
            {"name": "POSTGRES_HOST", "value": "pgbouncer"},
            {"name": "WORKER_NAME", "value": "w"},
        ]
        assert worker["envFrom"] == [{"configMapRef": {"name": "infrakitchen-config"}}]
        assert sidecar["image"] == "busybox"
        assert sidecar["env"] == [{"name": "WORKER_NAME", "value": "w"}]
        assert "envFrom" not in sidecar

    def test_template_image_wins(self, template):
        pod = build_pod(template, template.configuration, {}, BackendContainer(image="ik:other"))
        assert pod["spec"]["containers"][0]["image"] == "ik:latest"

    def test_pod_name_prefix(self):
        assert pod_name_prefix("default") == "ik-worker-default-"
        assert pod_name_prefix("!!!") == "ik-worker-"
        assert len(pod_name_prefix("x" * 100)) <= 63 - 5


class TestPodToInstance:
    @pytest.mark.parametrize(
        "phase, expected",
        [
            ("Pending", "pending"),
            ("Running", "running"),
            ("Succeeded", "succeeded"),
            ("Failed", "failed"),
            (None, "unknown"),
        ],
    )
    def test_phase_mapping(self, phase, expected):
        instance = pod_to_instance(make_pod("ik-worker-a", phase))
        assert instance.phase == expected
        assert instance.host == "ik-worker-a"
        assert instance.details["node"] == "node-1"


class TestBackendContainer:
    async def test_reads_infrakitchen_container_once(self, client):
        backend = await get_backend_container(client)
        _ = await get_backend_container(client)

        client.read_namespaced_pod.assert_awaited_once_with("infrakitchen-scheduler-abc", "infrakitchen")
        assert backend.image == "ik:1.2.3"
        assert [item["name"] for item in backend.env] == ["POSTGRES_HOST", "POSTGRES_PASSWORD"]
        assert backend.env[1]["valueFrom"]["secretKeyRef"]["name"] == "infrakitchen-secrets"
        assert backend.env_from == [{"configMapRef": {"name": "infrakitchen-config"}}]

    async def test_unreadable_pod(self, client):
        client.read_namespaced_pod.side_effect = ApiException(status=403, reason="Forbidden")

        with pytest.raises(KubernetesUnavailable, match="Forbidden"):
            _ = await get_backend_container(client)


class TestKubernetesWorkerProvider:
    def test_registry(self, template):
        assert isinstance(get_worker_provider(template), KubernetesWorkerProvider)

    async def test_spawn(self, template, client):
        client.create_namespaced_pod.return_value = make_pod("ik-worker-x", "Pending")
        provider = KubernetesWorkerProvider(template, client=client)

        instance = await provider.spawn({"WORKER_NAME": "w"})

        assert instance.id == "ik-worker-x"
        namespace, body = client.create_namespaced_pod.await_args.args
        assert namespace == "ik"
        assert body["metadata"]["labels"][TEMPLATE_LABEL] == str(template.id)
        env = {item["name"]: item for item in body["spec"]["containers"][0]["env"]}
        assert env["POSTGRES_HOST"] == {"name": "POSTGRES_HOST", "value": "db"}  # set in the template
        assert env["POSTGRES_PASSWORD"]["valueFrom"]["secretKeyRef"]["name"] == "infrakitchen-secrets"
        assert "WORKER_AUTOSCALER_ENABLED" not in env

    async def test_list_instances_uses_label_selector(self, template, client):
        client.list_labeled_pods.return_value = [make_pod("a", "Running")]
        provider = KubernetesWorkerProvider(template, client=client)

        instances = await provider.list_instances()

        assert [i.id for i in instances] == ["a"]
        client.list_labeled_pods.assert_awaited_once_with(
            "ik", f"{MANAGED_BY_LABEL}=infrakitchen,{TEMPLATE_LABEL}={template.id}"
        )

    async def test_delete_ignores_missing_pod(self, template, client):
        client.delete_namespaced_pod.side_effect = ApiException(status=404)
        provider = KubernetesWorkerProvider(template, client=client)

        await provider.delete_instance(WorkerInstance(id="gone", host="gone"))

    async def test_delete_raises_other_errors(self, template, client):
        client.delete_namespaced_pod.side_effect = ApiException(status=403)
        provider = KubernetesWorkerProvider(template, client=client)

        with pytest.raises(ApiException):
            await provider.delete_instance(WorkerInstance(id="a", host="a"))

    async def test_validate_uses_dry_run(self, template, client):
        provider = KubernetesWorkerProvider(template, client=client)

        await provider.validate()

        assert client.create_namespaced_pod.await_args.kwargs == {"dry_run": True}

    def test_default_namespace(self, template, client):
        template.configuration.namespace = None
        assert KubernetesWorkerProvider(template, client=client).namespace == "infrakitchen"
