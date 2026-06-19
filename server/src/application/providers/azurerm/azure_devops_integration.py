import uuid
from typing import Any, cast

from application.integrations.dependencies import get_integration_service
from core.adapters.provider_adapters import IntegrationProvider
from sqlalchemy.ext.asyncio import AsyncSession

from .azure_devops_api import AzureDevopsApi


async def get_azure_devops_client(integration_id: uuid.UUID | None, session: AsyncSession) -> AzureDevopsApi:
    service = get_integration_service(session=session)
    if not integration_id:
        integrations = await service.get_all(filter={"integration_provider": "azure_devops"})
        if not integrations:
            raise ValueError("No Azure DevOps integrations found")
        if len(integrations) > 1:
            raise ValueError("Multiple Azure DevOps integrations found, please specify integration_id")
        integration = integrations[0]
    else:
        integration = await service.get_by_id(integration_id)

    if not integration or integration.integration_provider != "azure_devops":
        raise ValueError("Integration for Azure DevOps not found")

    provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get("azure_devops")
    if not provider_adapter:
        raise ValueError("Provider adapter for Azure DevOps not found")

    provider = cast(Any, provider_adapter)(configuration=integration.configuration)
    await provider.authenticate()
    return await provider.get_api_client()
