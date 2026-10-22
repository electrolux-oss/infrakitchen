import re
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, ClassVar, Literal

from pydantic import BaseModel, Field

from ..model import WorkerTemplateDTO

WorkerInstancePhase = Literal["pending", "running", "succeeded", "failed", "unknown"]

# Phases of instances that still hold (or will hold) a worker
ACTIVE_PHASES: set[WorkerInstancePhase] = {"pending", "running"}

# Names of spawned workers start with this, followed by the template slug
WORKER_NAME_PREFIX = "ik-worker-"

MANAGED_BY_LABEL = "app.kubernetes.io/managed-by"
MANAGED_BY_VALUE = "infrakitchen"
TEMPLATE_LABEL = "infrakitchen.io/worker-template"


def instance_labels(template: WorkerTemplateDTO) -> dict[str, str]:
    return {MANAGED_BY_LABEL: MANAGED_BY_VALUE, TEMPLATE_LABEL: str(template.id)}


class WorkerInstance(BaseModel):
    """A worker spawned by a provider, e.g. a Kubernetes pod."""

    id: str = Field(..., description="Provider-native id, e.g. the pod name")
    host: str = Field(..., description="Hostname the worker registers with (matches workers.host)")
    phase: WorkerInstancePhase = Field(default="unknown")
    created_at: datetime | None = Field(default=None)
    finished_at: datetime | None = Field(default=None, description="When the worker process exited, if known")
    reason: str | None = Field(default=None, description="Why the instance failed or is not running yet")
    details: dict[str, Any] = Field(default_factory=dict, description="Provider-specific extras")


def template_slug(template_name: str, max_length: int = 40) -> str:
    """Template name reduced to what pod and container names allow."""
    return re.sub(r"[^a-z0-9-]+", "-", template_name.lower()).strip("-")[:max_length].rstrip("-")


def worker_name_prefix(template_name: str) -> str:
    slug = template_slug(template_name)
    return f"{WORKER_NAME_PREFIX}{slug}-" if slug else WORKER_NAME_PREFIX


# Environment variables never copied from the InfraKitchen process to spawned workers:
# set per worker by the autoscaler, or only meaningful for the process that has them
NOT_INHERITED_ENV = {"HOSTNAME", "HOME", "PATH", "WORKER_IDLE_EXIT_SECONDS", "WORKER_TEMPLATE_ID", "WORKER_NAME"}
NOT_INHERITED_ENV_PREFIXES = ("WORKER_AUTOSCALER_",)


SENSITIVE_ENV_PARTS = ("KEY", "SECRET", "PASSWORD", "PASSWD", "TOKEN", "CREDENTIAL", "PRIVATE", "DSN", "URL", "URI")
MASKED = "********"


def mask_env(env: list[str]) -> list[str]:
    """``KEY=value`` entries with the value hidden for names that look like secrets."""
    masked: list[str] = []
    for item in env:
        name, separator, _ = item.partition("=")
        masked.append(f"{name}={MASKED}" if separator and any(p in name.upper() for p in SENSITIVE_ENV_PARTS) else item)
    return masked


def is_inherited_env(name: str) -> bool:
    return name not in NOT_INHERITED_ENV and not name.startswith(NOT_INHERITED_ENV_PREFIXES)


class WorkerProvider(ABC):
    """Spawns, lists and deletes on-demand task workers for one worker template.

    New backends (ECS, Nomad, VMs, ...) implement this interface, add their config model to
    ``WorkerProviderConfig`` and register themselves in ``WORKER_PROVIDERS``.
    """

    provider: ClassVar[str]

    def __init__(self, template: WorkerTemplateDTO):
        self.template: WorkerTemplateDTO = template

    @abstractmethod
    async def spawn(self, env: dict[str, str]) -> WorkerInstance:
        """Start one worker. ``env`` must reach the worker process as environment variables."""

    @abstractmethod
    async def list_instances(self) -> list[WorkerInstance]:
        """All instances spawned from this template, in any phase."""

    @abstractmethod
    async def delete_instance(self, instance: WorkerInstance) -> None:
        """Remove an instance. Must not fail if it is already gone."""

    async def get_logs(self, instance: WorkerInstance, tail: int = 500) -> str:
        """The last ``tail`` log lines of an instance. Providers that cannot read logs keep this default."""
        raise NotImplementedError(f"The {self.provider} provider cannot read worker logs")

    async def get_manifest(self, instance: WorkerInstance) -> dict[str, Any]:
        """How an instance was created, e.g. the container inspect output, with secrets masked."""
        raise NotImplementedError(f"The {self.provider} provider cannot show worker manifests")

    async def validate(self) -> None:
        """Deep check of the configuration against the backend. Raises on problems."""
        return None

    @classmethod
    @abstractmethod
    def default_configuration(cls) -> dict[str, Any]:
        """Configuration used to prefill a new template of this provider."""
