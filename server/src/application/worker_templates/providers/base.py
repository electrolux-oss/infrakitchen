from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, ClassVar, Literal

from pydantic import BaseModel, Field

from ..model import WorkerTemplateDTO

WorkerInstancePhase = Literal["pending", "running", "succeeded", "failed", "unknown"]

# Phases of instances that still hold (or will hold) a worker
ACTIVE_PHASES: set[WorkerInstancePhase] = {"pending", "running"}
# Phases of instances whose worker process has exited and that only need cleanup
TERMINAL_PHASES: set[WorkerInstancePhase] = {"succeeded", "failed"}

MANAGED_BY_LABEL = "app.kubernetes.io/managed-by"
MANAGED_BY_VALUE = "infrakitchen"
TEMPLATE_LABEL = "infrakitchen.io/worker-template"


class WorkerInstance(BaseModel):
    """A worker spawned by a provider, e.g. a Kubernetes pod."""

    id: str = Field(..., description="Provider-native id, e.g. the pod name")
    host: str = Field(..., description="Hostname the worker registers with (matches workers.host)")
    phase: WorkerInstancePhase = Field(default="unknown")
    created_at: datetime | None = Field(default=None)
    details: dict[str, Any] = Field(default_factory=dict, description="Provider-specific extras")


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

    async def validate(self) -> None:
        """Deep check of the configuration against the backend. Raises on problems."""
        return None

    @classmethod
    @abstractmethod
    def default_configuration(cls) -> dict[str, Any]:
        """Configuration used to prefill a new template of this provider."""
