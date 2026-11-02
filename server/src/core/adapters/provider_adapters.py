from datetime import datetime
from typing import Any, Literal, Protocol
from uuid import UUID

from pydantic import BaseModel, Field

from core.tools.kubernetes_client import KubernetesClient


class SecretProviderAdapter:
    """Base adapter class for secret providers like vault, secret manager.
    Deprecated: Use `IntegrationProvider` instead.

    Attributes:
        adapters (dict): Registry of adapter subclasses
        environment_variables (dict): Environment variables for configuration
    """

    __secret_provider_adapter_name__: str = ""

    adapters: dict[str, Any] = {}
    environment_variables: dict[str, str] = {}

    @classmethod
    def __init_subclass__(cls, **kwargs):
        """Register adapter subclass in adapters registry."""
        super().__init_subclass__(**kwargs)
        cls.adapters[cls.__secret_provider_adapter_name__] = cls

    async def is_valid(self) -> str:
        """Validate the connection to the secret provider.

        Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement is_valid method.")

    async def add_secrets_to_env(self, **kwargs) -> None:
        """Add secrets to environment variables.

        Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement add_secrets_to_env method.")


class StorageProviderAdapter:
    """Base adapter class for cloud backend providers like Tofu, CloudFormation.

    Attributes:
        adapters (dict): Registry of adapter subclasses
        environment_variables (dict): Environment variables for configuration
    """

    __cloud_backend_provider_adapter_name__: str = ""

    adapters: dict[str, Any] = {}
    environment_variables: dict[str, str] = {}

    @classmethod
    def __init_subclass__(cls, **kwargs):
        """Register adapter subclass in adapters registry."""
        super().__init_subclass__(**kwargs)
        cls.adapters[cls.__cloud_backend_provider_adapter_name__] = cls

    async def create(self) -> None:
        """Create cloud backend resources.

        Must be implemented by subclasses.
        """
        pass

    async def destroy(self) -> None:
        """Destroy cloud backend resources.

        Must be implemented by subclasses.
        """
        pass


class NotificationProviderAdapter:
    """Base adapter class for notification providers like Slack.

    Attributes:
        adapters (dict): Registry of adapter subclasses
        environment_variables (dict): Environment variables for configuration
    """

    __notification_provider_adapter_name__: str = ""

    notification_adapters: dict[str, Any] = {}
    environment_variables: dict[str, str] = {}
    workspace_root: str | None = None

    @classmethod
    def __init_subclass__(cls, **kwargs):
        """Register adapter subclass in adapters registry."""
        super().__init_subclass__(**kwargs)
        cls.notification_adapters[cls.__notification_provider_adapter_name__] = cls

    async def authenticate(self) -> None:
        """Authenticate with the notification provider.

        Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement authenticate method.")

    async def is_valid(self) -> bool:
        """Validate the connection to the notification provider.

        Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement is_valid method.")

    async def send_notification(self, **kwargs) -> None:
        """Send notification through provider.

        Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement send_notification method.")


class IntegrationProvider:
    """Base class for integration providers. Like GitHub, AWS, Atlas etc.

    Attributes:
        adapters (dict): Registry of adapter subclasses
        environment_variables (dict): Environment variables for configuration
    """

    __integration_provider_name__: str = ""
    __integration_provider_type__: str = ""

    adapters: dict[str, Any] = {}
    environment_variables: dict[str, str] = {}
    workspace_root: str | None = None

    @classmethod
    def __init_subclass__(cls, **kwargs):
        """Register adapter subclass in adapters registry."""
        super().__init_subclass__(**kwargs)
        cls.adapters[cls.__integration_provider_name__] = cls

    async def authenticate(self) -> None:
        """Authenticate with the integration provider.

        Must be implemented by subclasses.
        """
        pass

    async def verify_auth(self) -> None:
        """
        (Optional) Additional network verification step.
        Subclasses (like GithubProvider) override this. Exists here for type safety.
        """
        pass

    async def get_api_client(self) -> Any:
        """Get the api client for the integration provider.

        Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement get_api_client method.")

    async def get_git_client(self, git_url: str, workspace_root: str, repo_name: str) -> Any:
        """Get the git client for the integration provider.

        Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement get_git_client method.")

    async def get_kubernetes_client(self, cluster_metadata: dict[str, Any]) -> KubernetesClient:
        """Get the kubernetes client for the integration provider.

        Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement get_kubernetes_client method.")

    async def is_valid(self) -> bool:
        """Validate the connection to the integration provider.

        Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement is_valid method.")


WorkerInstancePhase = Literal["pending", "running", "succeeded", "failed", "unknown"]

# Phases of instances that still hold (or will hold) a worker
ACTIVE_PHASES: set[WorkerInstancePhase] = {"pending", "running"}


class WorkerInstance(BaseModel):
    """A worker spawned by a provider, e.g. a Kubernetes pod."""

    id: str = Field(..., description="Provider-native id, e.g. the pod name")
    host: str = Field(..., description="Hostname the worker registers with (matches workers.host)")
    phase: WorkerInstancePhase = Field(default="unknown")
    created_at: datetime | None = Field(default=None)
    finished_at: datetime | None = Field(default=None, description="When the worker process exited, if known")
    reason: str | None = Field(default=None, description="Why the instance failed or is not running yet")
    details: dict[str, Any] = Field(default_factory=dict, description="Provider-specific extras")


class WorkerTemplateSpec(Protocol):
    """What a worker provider needs to know about the worker template it spawns workers for."""

    @property
    def id(self) -> UUID: ...

    @property
    def name(self) -> str: ...

    @property
    def configuration(self) -> object: ...


class WorkerProviderAdapter:
    """Base adapter class for providers that spawn on-demand task workers, like Kubernetes.

    Spawns, lists and deletes the workers of one worker template.

    Attributes:
        adapters (dict): Registry of adapter subclasses
    """

    __worker_provider_adapter_name__: str = ""

    adapters: dict[str, type["WorkerProviderAdapter"]] = {}

    @classmethod
    def __init_subclass__(cls, **kwargs):
        """Register adapter subclass in adapters registry."""
        super().__init_subclass__(**kwargs)
        cls.adapters[cls.__worker_provider_adapter_name__] = cls

    def __init__(self, template: WorkerTemplateSpec):
        self.template: WorkerTemplateSpec = template

    async def spawn(self, env: dict[str, str]) -> WorkerInstance:
        """Start one worker. ``env`` must reach the worker process as environment variables.

        Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement spawn method.")

    async def list_instances(self) -> list[WorkerInstance]:
        """All instances spawned from the template, in any phase.

        Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement list_instances method.")

    async def delete_instance(self, instance: WorkerInstance) -> None:
        """Remove an instance. Must not fail if it is already gone.

        Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement delete_instance method.")

    async def get_logs(self, instance: WorkerInstance, tail: int = 500) -> str:
        """The last ``tail`` log lines of an instance."""
        raise NotImplementedError(f"The {self.__worker_provider_adapter_name__} provider cannot read worker logs")

    async def get_manifest(self, instance: WorkerInstance) -> dict[str, Any]:
        """How an instance was created, e.g. the container inspect output, with secrets masked."""
        raise NotImplementedError(f"The {self.__worker_provider_adapter_name__} provider cannot show worker manifests")

    async def validate(self) -> None:
        """Deep check of the configuration against the backend. Raises on problems."""
        return None

    @property
    def location(self) -> str:
        """Where instances are listed, e.g. a namespace. Instances left in a previous location are no longer managed."""
        return ""

    @classmethod
    def default_configuration(cls) -> dict[str, Any]:
        """Configuration used to prefill a new template of this provider.

        Must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement default_configuration method.")
