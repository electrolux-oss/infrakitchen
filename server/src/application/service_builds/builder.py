import base64
from dataclasses import dataclass, field
from datetime import datetime, UTC
import json
import logging
import os
from typing import Any
from uuid import UUID

from kubernetes_asyncio import client, config
from kubernetes_asyncio.client import ApiException

from core.config import Settings
from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ImageBuildRequest:
    context_dir: str
    dockerfile: str
    images: tuple[str, ...]
    registry: str
    registry_username: str
    registry_password: str = field(repr=False)
    labels: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class ImageBuildResult:
    digest: str


def _docker_config(request: ImageBuildRequest) -> str:
    auth = base64.b64encode(f"{request.registry_username}:{request.registry_password}".encode()).decode()
    return json.dumps({"auths": {request.registry: {"auth": auth}}})


@dataclass(frozen=True)
class GitSource:
    url: str = field(repr=False)
    commit_sha: str
    ssh_private_key: str | None = field(default=None, repr=False)


SERVICE_ACCOUNT_NAMESPACE_FILE = "/var/run/secrets/kubernetes.io/serviceaccount/namespace"
JOB_WORKSPACE = "/workspace"
BUILD_USER_ID = 1000

CLONE_SCRIPT = """\
set -eu
if [ -f /secrets/ssh-key ]; then
  install -m 600 /secrets/ssh-key /tmp/ssh-key
  export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no -i /tmp/ssh-key"
fi
git init -q "$WORKSPACE"
cd "$WORKSPACE"
git remote add origin "$(cat /secrets/git-url)"
git fetch -q --depth 1 origin "$COMMIT_SHA" || git fetch -q origin
git -c advice.detachedHead=false checkout -q "$COMMIT_SHA"
echo "Checked out $COMMIT_SHA"
"""

# Waiting reasons that won't resolve by themselves
FATAL_WAITING_REASONS = {
    "ErrImagePull",
    "ImagePullBackOff",
    "InvalidImageName",
    "ErrImageNeverPull",
    "CreateContainerConfigError",
    "CreateContainerError",
    "RunContainerError",
}

_configuration: client.Configuration | None = None


def incluster_configuration() -> client.Configuration:
    global _configuration
    if _configuration is None:
        configuration = client.Configuration()
        try:
            config.load_incluster_config(client_configuration=configuration)
        except config.ConfigException as e:
            raise CannotProceed(
                f"The worker is not running inside a Kubernetes cluster, cannot run image builds: {e}"
            ) from e
        _configuration = configuration
    return _configuration


def incluster_namespace() -> str:
    try:
        with open(SERVICE_ACCOUNT_NAMESPACE_FILE) as f:
            return f.read().strip()
    except OSError:
        return "default"


class KubernetesJobBuilder:
    """Runs each build as a rootless BuildKit Job in the worker's cluster."""

    def __init__(self, settings: Settings) -> None:
        self.settings: Settings = settings

    @property
    def poll_seconds(self) -> int:
        return self.settings.IMAGE_BUILD_POLL_SECONDS

    @staticmethod
    def job_name(build_id: UUID) -> str:
        return f"ik-build-{build_id}"

    @property
    def namespace(self) -> str:
        return self.settings.IMAGE_BUILD_NAMESPACE or incluster_namespace()

    async def start(self, build_id: UUID, source: GitSource, request: ImageBuildRequest, logger: EntityLogger) -> None:
        name = self.job_name(build_id)
        namespace = self.namespace
        async with client.ApiClient(incluster_configuration()) as api:
            batch = client.BatchV1Api(api)
            try:
                job = await batch.create_namespaced_job(namespace, self._job_manifest(name, build_id, source, request))
            except ApiException as e:
                if e.status != 409:
                    raise
                job = await batch.read_namespaced_job(name, namespace)

            secret_data = {"git-url": source.url, "config.json": _docker_config(request)}
            if source.ssh_private_key:
                secret_data["ssh-key"] = f"{source.ssh_private_key.strip()}\n"
            secret: Any = {
                "apiVersion": "v1",
                "kind": "Secret",
                "metadata": {
                    "name": name,
                    "labels": self._labels(build_id),
                    "ownerReferences": [
                        {"apiVersion": "batch/v1", "kind": "Job", "name": name, "uid": job.metadata.uid}
                    ],
                },
                "type": "Opaque",
                "stringData": secret_data,
            }
            try:
                _ = await client.CoreV1Api(api).create_namespaced_secret(namespace, secret)
            except ApiException as e:
                if e.status != 409:
                    raise
        logger.info(f"Started build Job {namespace}/{name}; its log is copied here when it finishes")

    async def poll(self, build_id: UUID, logger: EntityLogger) -> ImageBuildResult | None:
        name = self.job_name(build_id)
        namespace = self.namespace
        async with client.ApiClient(incluster_configuration()) as api:
            batch = client.BatchV1Api(api)
            core = client.CoreV1Api(api)
            try:
                job = await batch.read_namespaced_job(name, namespace)
            except ApiException as e:
                if e.status == 404:
                    raise ValueError(f"The build Job {namespace}/{name} no longer exists") from e
                logger.warning(f"Could not read build Job {namespace}/{name}: {e.reason}")
                return None

            conditions = {c.type: c for c in job.status.conditions or [] if c.status == "True"}
            pod = await self._job_pod(core, name, namespace)
            if "Complete" not in conditions and "Failed" not in conditions:
                problem = self._start_problem(job, pod)
                if problem is None:
                    return None
                await self._delete_job(batch, name, namespace)
                raise ValueError(problem)

            if pod:
                await self._copy_logs(core, pod, namespace, logger)
            if "Failed" in conditions:
                await self._delete_secret(core, name, namespace)
                failed = conditions["Failed"]
                minutes = self.settings.IMAGE_BUILD_FAILED_RETENTION_SECONDS // 60
                raise ValueError(
                    f"The build Job failed: {failed.reason or ''} {failed.message or ''}".strip()
                    + f". Job {namespace}/{name} is kept for {minutes} minutes"
                )
            try:
                return ImageBuildResult(digest=self._digest(pod))
            finally:
                await self._delete_job(batch, name, namespace)

    def _start_problem(self, job: Any, pod: Any) -> str | None:
        statuses = (
            [*(pod.status.init_container_statuses or []), *(pod.status.container_statuses or [])]
            if pod and pod.status
            else []
        )
        for status in statuses:
            waiting = status.state.waiting if status.state else None
            if waiting and waiting.reason in FATAL_WAITING_REASONS:
                message = f": {waiting.message}" if waiting.message else ""
                return f"Build container {status.name} cannot start: {waiting.reason}{message}"
        if any(status.state and (status.state.running or status.state.terminated) for status in statuses):
            return None

        created_at = job.metadata.creation_timestamp
        timeout = self.settings.IMAGE_BUILD_START_TIMEOUT_SECONDS
        if created_at is None or (datetime.now(UTC) - created_at).total_seconds() < timeout:
            return None
        if pod is None:
            return f"No build pod was created within {timeout} seconds"
        unscheduled = next(
            (c for c in pod.status.conditions or [] if c.type == "PodScheduled" and c.status == "False"), None
        )
        reason = f": {unscheduled.message}" if unscheduled and unscheduled.message else ""
        return f"The build pod did not start within {timeout} seconds{reason}"

    @staticmethod
    async def _job_pod(core: client.CoreV1Api, name: str, namespace: str) -> Any:
        pods = await core.list_namespaced_pod(namespace, label_selector=f"job-name={name}")
        return pods.items[-1] if pods.items else None

    @staticmethod
    async def _copy_logs(core: client.CoreV1Api, pod: Any, namespace: str, logger: EntityLogger) -> None:
        statuses = [*(pod.status.init_container_statuses or []), *(pod.status.container_statuses or [])]
        started = {s.name for s in statuses if s.state.running or s.state.terminated}
        for container in ("clone", "build"):
            if container not in started:
                continue
            try:
                log = await core.read_namespaced_pod_log(pod.metadata.name, namespace, container=container)
            except ApiException as e:
                logger.warning(f"Could not read the {container} log: {e.reason}")
                continue
            for line in log.splitlines():
                logger.info(line)

    @staticmethod
    def _digest(pod: Any) -> str:
        for status in (pod.status.container_statuses or []) if pod else []:
            if status.name == "build" and status.state.terminated and status.state.terminated.message:
                digest = json.loads(status.state.terminated.message).get("containerimage.digest")
                if digest:
                    return digest
        raise ValueError("The build finished without reporting the pushed image digest")

    @staticmethod
    async def _delete_job(batch: client.BatchV1Api, name: str, namespace: str) -> None:
        try:
            _ = await batch.delete_namespaced_job(name, namespace, propagation_policy="Background")
        except ApiException as e:
            if e.status != 404:
                logger.warning(f"Could not delete build Job {namespace}/{name}: {e.reason}")

    @staticmethod
    async def _delete_secret(core: client.CoreV1Api, name: str, namespace: str) -> None:
        try:
            _ = await core.delete_namespaced_secret(name, namespace)
        except ApiException as e:
            if e.status != 404:
                logger.warning(f"Could not delete build Secret {namespace}/{name}: {e.reason}")

    @staticmethod
    def _labels(build_id: UUID) -> dict[str, str]:
        return {"app.kubernetes.io/managed-by": "infrakitchen", "infrakitchen.io/service-build": str(build_id)}

    def _job_manifest(self, name: str, build_id: UUID, source: GitSource, request: ImageBuildRequest) -> Any:
        dockerfile_dir, dockerfile_name = os.path.split(request.dockerfile)
        build_args = [
            "build",
            "--progress",
            "plain",
            "--frontend",
            "dockerfile.v0",
            "--local",
            f"context={request.context_dir}",
            "--local",
            f"dockerfile={dockerfile_dir}",
            "--opt",
            f"filename={dockerfile_name}",
            "--output",
            # The output is parsed as CSV, so the comma separated names are quoted
            f'type=image,"name={",".join(request.images)}",push=true',
            "--metadata-file",
            "/tmp/metadata.json",
        ]
        for key, value in request.labels.items():
            build_args += ["--opt", f"label:{key}={value}"]

        labels = self._labels(build_id)
        return {
            "apiVersion": "batch/v1",
            "kind": "Job",
            "metadata": {"name": name, "labels": labels},
            "spec": {
                "backoffLimit": 0,
                "activeDeadlineSeconds": self.settings.IMAGE_BUILD_TIMEOUT_SECONDS,
                "ttlSecondsAfterFinished": self.settings.IMAGE_BUILD_FAILED_RETENTION_SECONDS,
                "template": {
                    "metadata": {"labels": labels},
                    "spec": {
                        "restartPolicy": "Never",
                        "automountServiceAccountToken": False,
                        "securityContext": {
                            "runAsUser": BUILD_USER_ID,
                            "runAsGroup": BUILD_USER_ID,
                            "fsGroup": BUILD_USER_ID,
                        },
                        "initContainers": [
                            {
                                "name": "clone",
                                "image": self.settings.IMAGE_BUILD_GIT_IMAGE,
                                "command": ["sh", "-c", CLONE_SCRIPT],
                                # ssh needs a passwd entry and the git image only has root
                                "securityContext": {"runAsUser": 0, "runAsGroup": 0},
                                "env": [
                                    {"name": "HOME", "value": "/tmp"},
                                    {"name": "WORKSPACE", "value": JOB_WORKSPACE},
                                    {"name": "COMMIT_SHA", "value": source.commit_sha},
                                ],
                                "volumeMounts": [
                                    {"name": "workspace", "mountPath": JOB_WORKSPACE},
                                    {"name": "secrets", "mountPath": "/secrets", "readOnly": True},
                                ],
                            }
                        ],
                        "containers": [
                            {
                                "name": "build",
                                "image": self.settings.IMAGE_BUILD_BUILDKIT_IMAGE,
                                "command": [
                                    "sh",
                                    "-c",
                                    # busybox cp can't overwrite the termination log
                                    'buildctl-daemonless.sh "$@" && cat /tmp/metadata.json > /dev/termination-log',
                                    "buildctl",
                                ],
                                "args": build_args,
                                "env": [
                                    # Required for rootless BuildKit in an unprivileged pod
                                    {"name": "BUILDKITD_FLAGS", "value": "--oci-worker-no-process-sandbox"},
                                    {"name": "DOCKER_CONFIG", "value": "/secrets"},
                                ],
                                "securityContext": {
                                    "seccompProfile": {"type": "Unconfined"},
                                    "appArmorProfile": {"type": "Unconfined"},
                                },
                                "volumeMounts": [
                                    {"name": "workspace", "mountPath": JOB_WORKSPACE, "readOnly": True},
                                    {"name": "secrets", "mountPath": "/secrets", "readOnly": True},
                                    {"name": "buildkitd", "mountPath": "/home/user/.local/share/buildkit"},
                                ],
                            }
                        ],
                        "volumes": [
                            {"name": "workspace", "emptyDir": {}},
                            {"name": "buildkitd", "emptyDir": {}},
                            {"name": "secrets", "secret": {"secretName": name, "defaultMode": 0o440}},
                        ],
                    },
                },
            },
        }
