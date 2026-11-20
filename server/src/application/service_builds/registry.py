from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.dependencies import get_integration_service
from application.integrations.model import Integration, IntegrationDTO
from core.adapters.functions import get_integration_adapter
from core.adapters.provider_adapters import ContainerRegistryProvider
from core.constants.model import ModelStatus
from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed


async def get_container_registry(
    session: AsyncSession, integration: Integration, logger: EntityLogger
) -> ContainerRegistryProvider:
    dto = IntegrationDTO.model_validate(integration)
    if dto.integration_type != "container_registry":
        raise CannotProceed(f"Integration {dto.name} is not a container registry")
    if dto.status == ModelStatus.DISABLED:
        raise CannotProceed(f"Container registry integration {dto.name} is disabled")

    kwargs: dict[str, Any] = {"logger": logger}
    aws_configuration = await get_integration_service(session=session).resolve_linked_aws_configuration(
        dto.configuration
    )
    if aws_configuration:
        kwargs["aws_configuration"] = aws_configuration

    adapter = await get_integration_adapter(dto.integration_provider, dto.configuration, dto.id, **kwargs)
    if not isinstance(adapter, ContainerRegistryProvider):
        raise CannotProceed(f"Provider {dto.integration_provider} is not a container registry")
    return adapter
