import uuid
from typing import Any, cast

from application.integrations.dependencies import get_integration_service
from core.adapters.provider_adapters import IntegrationProvider
from sqlalchemy.ext.asyncio import AsyncSession

from .bitbucket_api import BitbucketApi


async def get_bitbucket_client(integration_id: uuid.UUID | None, session: AsyncSession) -> BitbucketApi:
    service = get_integration_service(session=session)
    if not integration_id:
        integrations = await service.get_all(filter={"integration_provider": "bitbucket"})
        if not integrations:
            raise ValueError("No Bitbucket integrations found")
        if len(integrations) > 1:
            raise ValueError("Multiple Bitbucket integrations found, please specify integration_id")
        integration = integrations[0]
    else:
        integration = await service.get_by_id(integration_id)

    if not integration or integration.integration_provider != "bitbucket":
        raise ValueError("Integration for Bitbucket not found")

    provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get("bitbucket")
    if not provider_adapter:
        raise ValueError("Provider adapter for Bitbucket not found")

    provider = cast(Any, provider_adapter)(configuration=integration.configuration)
    await provider.authenticate()
    return await provider.get_api_client()
