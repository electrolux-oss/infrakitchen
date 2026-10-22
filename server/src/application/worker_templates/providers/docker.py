import asyncio
import logging
import secrets
import socket
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, ClassVar

from core.tools.docker_client import DockerClient, DockerError

from ..model import WorkerTemplateDTO
from ..schema import DockerWorkerConfig, parse_memory
from .base import (
    WorkerInstance,
    WorkerInstancePhase,
    WorkerProvider,
    instance_labels,
    is_inherited_env,
    mask_env,
    worker_name_prefix,
)

logger = logging.getLogger(__name__)

# Docker reports this for times that are not set, e.g. FinishedAt of a running container
DOCKER_ZERO_TIME = "0001-01-01T00:00:00Z"


class DockerUnavailable(Exception):
    pass


@dataclass(frozen=True)
class OwnContainer:
    """Settings of the container this InfraKitchen process runs in, inherited by worker containers."""

    image: str | None = None
    env: dict[str, str] = field(default_factory=dict)
    network: str | None = None


# Per Docker host; an empty OwnContainer means InfraKitchen does not run in a container there
_own_containers: dict[str, OwnContainer] = {}
# One pull per image at a time, so a burst of spawns does not pull the same image N times
_pull_locks: dict[str, asyncio.Lock] = {}


async def get_own_container(client: DockerClient) -> OwnContainer:
    cached = _own_containers.get(client.docker_host)
    if cached is not None:
        return cached
    try:
        # Inside a container the hostname is the container id, unless it was overridden
        container = await client.inspect_container(socket.gethostname())
    except DockerError as e:
        if e.status != 404:
            raise
        own = OwnContainer()
    else:
        config = container.get("Config") or {}
        # Only what was set when the container was created, not the defaults baked into its image
        image_env: set[str] = set()
        try:
            image_config = (await client.inspect_image(container.get("Image") or config.get("Image", ""))).get("Config")
            image_env = set((image_config or {}).get("Env") or [])
        except DockerError as e:
            if e.status != 404:
                raise
        env: dict[str, str] = {}
        for item in config.get("Env") or []:
            name, _, value = item.partition("=")
            if item not in image_env and is_inherited_env(name):
                env[name] = value
        networks = list(((container.get("NetworkSettings") or {}).get("Networks") or {}).keys())
        own = OwnContainer(image=config.get("Image"), env=env, network=networks[0] if networks else None)
    _own_containers[client.docker_host] = own
    return own


def _parse_time(value: str | None) -> datetime | None:
    if not value or value.startswith(DOCKER_ZERO_TIME[:4]):
        return None
    # Docker uses nanoseconds, which fromisoformat does not accept
    head, _, rest = value.partition(".")
    if not rest:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    fraction = rest.rstrip("Z").split("+")[0].split("-")[0]
    return datetime.fromisoformat(f"{head}.{fraction[:6]}+00:00")


def container_name(template: WorkerTemplateDTO) -> str:
    return f"{worker_name_prefix(template.name)}{secrets.token_hex(3)}"


def build_container(
    template: WorkerTemplateDTO,
    config: DockerWorkerConfig,
    name: str,
    env: dict[str, str],
    own: OwnContainer,
) -> dict[str, Any]:
    """The body of the Docker create-container call for one worker."""
    image = config.image or own.image
    if not image:
        raise DockerUnavailable("Set an image: InfraKitchen does not run in a container to take it from")
    network = config.network or own.network

    merged_env = own.env | config.env | env
    host_config: dict[str, Any] = {
        # A worker that exits after idling must not be restarted; the autoscaler removes it instead
        "RestartPolicy": {"Name": "no"},
    }
    if network:
        host_config["NetworkMode"] = network
    if config.volumes:
        host_config["Binds"] = list(config.volumes)
    if config.memory:
        host_config["Memory"] = parse_memory(config.memory)
    if config.cpus:
        host_config["NanoCpus"] = int(config.cpus * 1_000_000_000)
    if config.extra_hosts:
        host_config["ExtraHosts"] = list(config.extra_hosts)

    return {
        "Image": image,
        "Cmd": list(config.command),
        # Workers register with their hostname, which must be the container name to match instances to workers
        "Hostname": name,
        "Env": [f"{key}={value}" for key, value in merged_env.items()],
        "Labels": instance_labels(template),
        "HostConfig": host_config,
    }


def container_to_instance(summary: dict[str, Any], details: dict[str, Any] | None = None) -> WorkerInstance:
    """Instance from a ``/containers/json`` entry; ``details`` (inspect) tells how an exited one ended."""
    name = (summary.get("Names") or [summary.get("Id", "")])[0].lstrip("/")
    state = summary.get("State", "")
    phase: WorkerInstancePhase = "unknown"
    reason: str | None = None
    finished_at: datetime | None = None
    match state:
        case "created":
            phase = "pending"
        case "running" | "restarting" | "paused":
            phase = "running"
        case "removing":
            phase = "succeeded"
        case "exited" | "dead":
            container_state = (details or {}).get("State") or {}
            exit_code = container_state.get("ExitCode", 0 if state == "exited" else 1)
            finished_at = _parse_time(container_state.get("FinishedAt"))
            if state == "exited" and exit_code == 0:
                phase = "succeeded"
            else:
                phase = "failed"
                if container_state.get("OOMKilled"):
                    reason = f"OOMKilled (exit code {exit_code})"
                elif container_state.get("Error"):
                    reason = f"{container_state['Error']} (exit code {exit_code})"
                else:
                    reason = f"Exited with code {exit_code}"
    created = summary.get("Created")
    return WorkerInstance(
        id=name,
        host=name,
        phase=phase,
        created_at=datetime.fromtimestamp(created, UTC) if isinstance(created, int | float) else None,
        finished_at=finished_at,
        reason=reason,
        details={"container_id": summary.get("Id"), "image": summary.get("Image"), "status": summary.get("Status")},
    )


class DockerWorkerProvider(WorkerProvider):
    provider: ClassVar[str] = "docker"

    def __init__(self, template: WorkerTemplateDTO, client: DockerClient | None = None):
        super().__init__(template)
        if not isinstance(template.configuration, DockerWorkerConfig):
            raise ValueError("Worker template is not configured for Docker")
        self.config: DockerWorkerConfig = template.configuration
        self.client: DockerClient = client or DockerClient(self.config.docker_host)

    @property
    def labels(self) -> dict[str, str]:
        return instance_labels(self.template)

    async def build(self, name: str, env: dict[str, str]) -> dict[str, Any]:
        return build_container(self.template, self.config, name, env, await get_own_container(self.client))

    async def _create(self, name: str, body: dict[str, Any]) -> str:
        try:
            return await self.client.create_container(name, body)
        except DockerError as e:
            if e.status != 404 or "image" not in e.message.lower():
                raise
        async with _pull_locks.setdefault(f"{self.config.docker_host}|{body['Image']}", asyncio.Lock()):
            if not await self.client.image_exists(body["Image"]):
                logger.info(f"Pulling worker image {body['Image']} for template {self.template.name}")
                await self.client.pull_image(body["Image"])
        return await self.client.create_container(name, body)

    async def spawn(self, env: dict[str, str]) -> WorkerInstance:
        name = container_name(self.template)
        container_id = await self._create(name, await self.build(name, env))
        try:
            await self.client.start_container(container_id)
        except Exception:
            # Do not leave a container behind that will never run
            await self.client.remove_container(container_id)
            raise
        logger.info(f"Spawned worker container {name} from template {self.template.name}")
        return WorkerInstance(id=name, host=name, phase="pending", details={"container_id": container_id})

    async def list_instances(self) -> list[WorkerInstance]:
        instances: list[WorkerInstance] = []
        for summary in await self.client.list_containers(self.labels):
            details = None
            if summary.get("State") in ("exited", "dead"):
                try:
                    details = await self.client.inspect_container(summary["Id"])
                except DockerError as e:
                    if e.status != 404:
                        raise
            instances.append(container_to_instance(summary, details))
        return instances

    async def delete_instance(self, instance: WorkerInstance) -> None:
        await self.client.remove_container(instance.details.get("container_id") or instance.id)
        logger.info(f"Deleted worker container {instance.id} ({instance.phase})")

    async def get_logs(self, instance: WorkerInstance, tail: int = 500) -> str:
        return await self.client.container_logs(instance.details.get("container_id") or instance.id, tail)

    async def get_manifest(self, instance: WorkerInstance) -> dict[str, Any]:
        manifest = await self.client.inspect_container(instance.details.get("container_id") or instance.id)
        config = manifest.get("Config")
        if isinstance(config, dict) and config.get("Env"):
            config["Env"] = mask_env(config["Env"])
        return manifest

    async def validate(self) -> None:
        try:
            await self.client.ping()
        except DockerError as e:
            raise DockerUnavailable(f"Docker daemon at {self.config.docker_host} answered with an error: {e}") from e
        except Exception as e:
            raise DockerUnavailable(f"Cannot reach the Docker daemon at {self.config.docker_host}: {e}") from e
        body = await self.build("validation", {})
        if not await self.client.image_exists(body["Image"]):
            logger.info(f"Image {body['Image']} is not on the Docker host yet; it is pulled on the first spawn")
        network = body["HostConfig"].get("NetworkMode")
        if network and network not in ("bridge", "host", "none") and not network.startswith("container:"):
            try:
                _ = await self.client.inspect_network(network)
            except DockerError as e:
                raise DockerUnavailable(f"Network '{network}' not found on the Docker host: {e.message}") from e

    @classmethod
    def default_configuration(cls) -> dict[str, Any]:
        return DockerWorkerConfig().model_dump()
