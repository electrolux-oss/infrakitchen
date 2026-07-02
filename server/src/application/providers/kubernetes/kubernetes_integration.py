from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.dependencies import get_integration_service
from application.resources.dependencies import get_resource_service
from core.adapters.cloud_resource_adapter import CloudResourceAdapter
from core.adapters.provider_adapters import IntegrationProvider
from core.tools.kubernetes_client import KubernetesClient


async def build_kubernetes_client(
    k8s_service: str,
    resource_id: str,
    session: AsyncSession,
) -> KubernetesClient:
    """Build a KubernetesClient for the given resource.

    This is transport-agnostic: it raises ``ValueError`` on failure so that
    both the REST view layer and GraphQL resolvers can translate to their
    own error format.
    """
    resource_service = get_resource_service(session=session)
    resource = await resource_service.get_by_id(resource_id)
    if not resource:
        raise ValueError("Resource not found")

    if k8s_service == "aws_eks":
        integration_provider = "aws"
    else:
        raise ValueError(f"Unsupported Kubernetes service: {k8s_service}")

    provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get(integration_provider)
    if not provider_adapter:
        raise ValueError(f"Provider adapter for '{integration_provider}' not found")

    cloud_provider: type[CloudResourceAdapter] | None = CloudResourceAdapter.providers.get(integration_provider)
    if not cloud_provider:
        raise ValueError(f"Cloud provider adapter for '{integration_provider}' not found")

    filtered_integration = next(
        (
            integration
            for integration in resource.integration_ids
            if integration.integration_provider == integration_provider
        ),
        None,
    )

    if not filtered_integration:
        raise ValueError(f"Integration for {integration_provider} not found in resource")

    integration_service = get_integration_service(session=session)
    integration = await integration_service.get_by_id(str(filtered_integration.id))

    if not integration:
        raise ValueError(f"Integration for integration_provider '{integration_provider}' not found")

    provider_adapter_instance: IntegrationProvider = provider_adapter(**{"configuration": integration.configuration})
    await provider_adapter_instance.authenticate()

    variables: dict[str, Any] = {}
    for variable in resource.variables:
        variables[variable.name] = variable.value

    cloud_resource: CloudResourceAdapter = CloudResourceAdapter.providers[integration.integration_provider](
        provider_adapter_instance.environment_variables
    )

    k8s_metadata = await cloud_resource.metadata(resource_name=k8s_service, **variables)

    return await provider_adapter_instance.get_kubernetes_client(k8s_metadata)
