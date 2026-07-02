import uuid
from typing import Any, cast

from application.integrations.dependencies import get_integration_service
from core.adapters.provider_adapters import IntegrationProvider
from sqlalchemy.ext.asyncio import AsyncSession

from .github_api import GithubApi


async def get_github_client(integration_id: uuid.UUID | None, session: AsyncSession) -> GithubApi:
    service = get_integration_service(session=session)
    if not integration_id:
        integrations = await service.get_all(filter={"integration_provider": "github"})
        if not integrations:
            raise ValueError("No Github integrations found")
        if len(integrations) > 1:
            raise ValueError("Multiple Github integrations found, please specify integration_id")
        integration = integrations[0]
    else:
        integration = await service.get_by_id(integration_id)

    if not integration or integration.integration_provider != "github":
        raise ValueError("Integration for Github not found")

    provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get("github")
    if not provider_adapter:
        raise ValueError("Provider adapter for Github not found")

    provider = cast(Any, provider_adapter)(configuration=integration.configuration)
    await provider.authenticate()
    return await provider.get_api_client()
