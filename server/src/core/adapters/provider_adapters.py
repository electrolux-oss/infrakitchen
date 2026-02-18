from typing import Any

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
