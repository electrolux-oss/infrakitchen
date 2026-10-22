import copy
import logging
import socket
from dataclasses import dataclass, field
from typing import Any, ClassVar

from kubernetes_asyncio.client import Configuration
from kubernetes_asyncio.client.exceptions import ApiException
from kubernetes_asyncio.config import ConfigException, load_incluster_config

from core.tools.kubernetes_client import KubernetesClient

from ..model import WorkerTemplateDTO
from ..schema import KubernetesWorkerConfig, parse_pod_manifest
from .base import (
    WorkerInstance,
    WorkerInstancePhase,
    WorkerProvider,
    instance_labels,
    is_inherited_env,
    worker_name_prefix,
)
from .kubernetes_default_manifest import DEFAULT_POD_MANIFEST

logger = logging.getLogger(__name__)

SERVICE_ACCOUNT_NAMESPACE_FILE = "/var/run/secrets/kubernetes.io/serviceaccount/namespace"

POD_PHASES: dict[str, WorkerInstancePhase] = {
    "Pending": "pending",
    "Running": "running",
    "Succeeded": "succeeded",
    "Failed": "failed",
}

# Container waiting reasons that will not resolve by themselves: the pod is failed right away
# instead of waiting for WORKER_START_TIMEOUT_SECONDS
FATAL_WAITING_REASONS = {
    "ErrImagePull",
    "ImagePullBackOff",
    "InvalidImageName",
    "ErrImageNeverPull",
    "CreateContainerConfigError",
    "CreateContainerError",
    "RunContainerError",
}

_client: KubernetesClient | None = None
_backend_container: "BackendContainer | None" = None


class KubernetesUnavailable(Exception):
    pass


def get_incluster_kubernetes_client() -> KubernetesClient:
    """Client authenticated with the ServiceAccount of the pod InfraKitchen runs in."""
    global _client
    if _client is None:
        configuration = Configuration()
        try:
            load_incluster_config(client_configuration=configuration)
        except ConfigException as e:
            raise KubernetesUnavailable(
                f"InfraKitchen is not running inside a Kubernetes cluster, cannot manage worker pods: {e}"
            ) from e
        _client = KubernetesClient(configuration)
    return _client


def incluster_namespace() -> str:
    try:
        with open(SERVICE_ACCOUNT_NAMESPACE_FILE) as f:
            return f.read().strip()
    except OSError:
        return "default"


@dataclass(frozen=True)
class BackendContainer:
    """InfraKitchen settings of the pod this process runs in, inherited by worker pods.

    ``env`` and ``env_from`` are copied as written in the pod spec, so secrets stay
    ``secretKeyRef``/``secretRef`` references and their values never leave Kubernetes.
    """

    image: str | None = None
    env: list[dict[str, Any]] = field(default_factory=list)
    env_from: list[dict[str, Any]] = field(default_factory=list)


def select_backend_container(pod: dict[str, Any]) -> dict[str, Any]:
    """The InfraKitchen container of a pod: the one configured with the database, else the first."""
    containers: list[dict[str, Any]] = (pod.get("spec") or {}).get("containers") or []
    if not containers:
        raise KubernetesUnavailable("The InfraKitchen pod has no containers")
    for container in containers:
        if any(item.get("name") == "POSTGRES_HOST" for item in container.get("env") or []):
            return container
    return containers[0]


async def get_backend_container(client: KubernetesClient) -> BackendContainer:
    """Read (once per process) the InfraKitchen container this process runs in."""
    global _backend_container
    if _backend_container is None:
        pod_name, namespace = socket.gethostname(), incluster_namespace()
        try:
            pod = await client.read_namespaced_pod(pod_name, namespace)
        except ApiException as e:
            raise KubernetesUnavailable(
                f"Cannot read InfraKitchen pod {namespace}/{pod_name} to copy its settings to workers: {e.reason}"
            ) from e
        container = select_backend_container(pod)
        _backend_container = BackendContainer(
            image=container.get("image"),
            env=[item for item in container.get("env") or [] if is_inherited_env(item.get("name", ""))],
            env_from=list(container.get("envFrom") or []),
        )
    return _backend_container


def inherit_backend_container(container: dict[str, Any], backend: BackendContainer) -> None:
    """Give the worker container InfraKitchen's image and settings; values set in the template win."""
    if not container.get("image") and backend.image:
        container["image"] = backend.image
    own_env = container.get("env") or []
    own_names = {item.get("name") for item in own_env}
    container["env"] = [item for item in backend.env if item.get("name") not in own_names] + own_env
    own_env_from = container.get("envFrom") or []
    container["envFrom"] = [item for item in backend.env_from if item not in own_env_from] + own_env_from
    if not container["envFrom"]:
        del container["envFrom"]


def set_container_env(container: dict[str, Any], env: dict[str, str]) -> None:
    existing = [item for item in container.get("env") or [] if item.get("name") not in env]
    container["env"] = existing + [{"name": name, "value": value} for name, value in env.items()]


def build_pod(
    template: WorkerTemplateDTO,
    config: KubernetesWorkerConfig,
    env: dict[str, str],
    backend: BackendContainer | None = None,
) -> dict[str, Any]:
    """Turn the template's pod manifest into the pod body sent to the Kubernetes API.

    The first container is the worker: it inherits InfraKitchen's image and settings from ``backend``.
    """
    pod = copy.deepcopy(parse_pod_manifest(config.pod_manifest))

    metadata = pod.setdefault("metadata", {}) or {}
    pod["metadata"] = metadata
    _ = metadata.pop("name", None)
    _ = metadata.pop("namespace", None)
    metadata["generateName"] = worker_name_prefix(template.name)
    labels = metadata.get("labels") or {}
    labels.update(instance_labels(template))
    metadata["labels"] = labels

    spec = pod["spec"]
    # A worker that exits after idling must not be restarted; the autoscaler removes the pod instead
    spec["restartPolicy"] = "Never"
    # Workers register with their hostname, which must be the pod name to match instances to workers
    _ = spec.pop("hostname", None)
    if backend is not None:
        inherit_backend_container(spec["containers"][0], backend)
    for container in spec["containers"]:
        set_container_env(container, env)
    return pod


def _container_problem(status: Any) -> tuple[WorkerInstancePhase | None, str | None, Any]:
    """Phase override, reason and finish time derived from the container statuses of a pod."""
    finished_at = None
    for container in (getattr(status, "container_statuses", None) or []) if status else []:
        state = container.state
        if state is None:
            continue
        waiting = state.waiting
        if waiting is not None and waiting.reason in FATAL_WAITING_REASONS:
            message = f"{waiting.reason}: {waiting.message}" if waiting.message else waiting.reason
            return "failed", message, None
        terminated = state.terminated
        if terminated is not None:
            finished_at = terminated.finished_at or finished_at
            if terminated.exit_code:
                reason = terminated.reason or "Error"
                return None, f"{reason} (exit code {terminated.exit_code})", finished_at
    return None, None, finished_at


def pod_to_instance(pod: Any) -> WorkerInstance:
    status = pod.status
    phase = POD_PHASES.get(status.phase if status else "", "unknown")
    override, reason, finished_at = _container_problem(status)
    if override is not None and phase in ("pending", "running", "unknown"):
        phase = override
    if reason is None and status is not None and phase in ("failed", "pending"):
        reason = status.message or status.reason
    return WorkerInstance(
        id=pod.metadata.name,
        host=pod.metadata.name,
        phase=phase,
        created_at=pod.metadata.creation_timestamp,
        finished_at=finished_at,
        reason=reason,
        details={
            "namespace": pod.metadata.namespace,
            "node": pod.spec.node_name if pod.spec else None,
            "reason": status.reason if status else None,
            "message": status.message if status else None,
            "deleting": pod.metadata.deletion_timestamp is not None,
        },
    )


class KubernetesWorkerProvider(WorkerProvider):
    provider: ClassVar[str] = "kubernetes"

    def __init__(self, template: WorkerTemplateDTO, client: KubernetesClient | None = None):
        super().__init__(template)
        if not isinstance(template.configuration, KubernetesWorkerConfig):
            raise ValueError("Worker template is not configured for Kubernetes")
        self.config: KubernetesWorkerConfig = template.configuration
        self._client: KubernetesClient | None = client

    @property
    def client(self) -> KubernetesClient:
        if self._client is None:
            self._client = get_incluster_kubernetes_client()
        return self._client

    @property
    def namespace(self) -> str:
        return self.config.namespace or incluster_namespace()

    @property
    def label_selector(self) -> str:
        return ",".join(f"{key}={value}" for key, value in instance_labels(self.template).items())

    async def build(self, env: dict[str, str]) -> dict[str, Any]:
        backend = await get_backend_container(self.client)
        return build_pod(self.template, self.config, env, backend)

    async def spawn(self, env: dict[str, str]) -> WorkerInstance:
        pod = await self.client.create_namespaced_pod(self.namespace, await self.build(env))
        instance = pod_to_instance(pod)
        logger.info(f"Spawned worker pod {instance.id} in {self.namespace} from template {self.template.name}")
        return instance

    async def list_instances(self) -> list[WorkerInstance]:
        pods = await self.client.list_labeled_pods(self.namespace, self.label_selector)
        return [pod_to_instance(pod) for pod in pods]

    async def delete_instance(self, instance: WorkerInstance) -> None:
        try:
            _ = await self.client.delete_namespaced_pod(instance.id, self.namespace)
        except ApiException as e:
            if e.status != 404:
                raise
        logger.info(f"Deleted worker pod {instance.id} ({instance.phase}) in {self.namespace}")

    async def get_logs(self, instance: WorkerInstance, tail: int = 500) -> str:
        return await self.client.read_namespaced_pod_log(instance.id, self.namespace, tail)

    async def validate(self) -> None:
        _ = await self.client.create_namespaced_pod(self.namespace, await self.build({}), dry_run=True)

    @classmethod
    def default_configuration(cls) -> dict[str, Any]:
        return KubernetesWorkerConfig(pod_manifest=DEFAULT_POD_MANIFEST).model_dump()
