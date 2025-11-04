from typing import Any


class CloudResourceAdapter:
    """Base adapter class for cloud resource management.

    This class serves as an abstract base for implementing cloud provider-specific adapters.
    It provides a registry of providers and defines the interface for resource operations.

    Class Attributes:
        providers (dict): Registry mapping provider names to adapter classes
        environment_variables (dict): Environment configuration for the adapter
    """

    __cloud_resource_adapter_name__: str = "cloud_resource_adapter"

    providers: dict[str, Any] = {}
    environment_variables: dict[str, str] = {}

    def __init__(self, environment_variables: dict[str, str], **kwargs):
        """Initialize the cloud resource adapter.

        Args:
            **kwargs: Provider-specific keyword arguments
        """

    @classmethod
    def __init_subclass__(cls, **kwargs):
        """Register provider adapter classes when they are defined.

        Args:
            **kwargs: Additional keyword arguments passed to parent
        """
        super().__init_subclass__(**kwargs)
        cls.providers[cls.__cloud_resource_adapter_name__] = cls

    async def metadata(self, resource_name: str, **kwargs) -> Any:
        """Get metadata about cloud resources.

        Args:
            resource_name (str): Name of cloud resource type
            **kwargs: Provider-specific keyword arguments

        Returns:
            None
        """
        raise NotImplementedError("Metadata retrieval must be implemented by subclasses")

    @classmethod
    async def get_resources(cls, **kwargs) -> list[str]:
        """Get list of available resource types.

        Args:
            **kwargs: Provider-specific parameters

        Returns:
            list[str]: List of supported resource type names

        Raises:
            NotImplementedError: Must be implemented by subclasses
        """
        raise NotImplementedError
