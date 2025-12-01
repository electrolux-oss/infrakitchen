import logging

from sqlalchemy.ext.asyncio import AsyncSession
from collections.abc import AsyncGenerator

from application.integrations.model import IntegrationDTO
from application.integrations.service import IntegrationService
from application.secrets.model import SecretDTO
from core.adapters.provider_adapters import IntegrationProvider
from core.custom_entity_log_controller import EntityLogger

from core.database import SessionLocal
from core.errors import CannotProceed

from ..providers import (
    SecretProviderAdapter,
)


logger = logging.getLogger(__name__)


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


class SecretManager:
    """
    Manager for handling secret management operations in different secret providers.
    """

    def __init__(
        self,
        logger: EntityLogger,
        integration_service: IntegrationService,
    ):
        self.logger: EntityLogger = logger
        self.integration_service: IntegrationService = integration_service

    async def get_credentials(self, secret: SecretDTO, environment_variables: dict[str, str]) -> None:
        secret_provider_adapter: type[SecretProviderAdapter] | None = SecretProviderAdapter.adapters.get(
            secret.secret_provider
        )

        if not secret_provider_adapter:
            raise CannotProceed(f"Provider {secret.secret_provider} is not supported")

        self.logger.info(f"Exporting secrets with provider {secret.secret_provider}")
        # use separate environment for authentication to avoid mixing credentials
        ev: dict[str, str] = {}

        if secret.integration_id:
            integration: IntegrationDTO | None = await self.integration_service.get_dto_by_id(
                integration_id=secret.integration_id,
            )
            if not integration:
                raise CannotProceed(f"Integration with id {secret.integration_id} not found for secret {secret.name}")

            integration_provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get(
                integration.integration_provider
            )
            if not integration_provider_adapter:
                raise CannotProceed(f"Integration provider {integration.integration_provider} is not supported")

            integration_provider_adapter_instance: IntegrationProvider = integration_provider_adapter(
                **{"logger": self.logger, "configuration": integration.configuration}
            )
            await integration_provider_adapter_instance.authenticate()
            ev.update(**integration_provider_adapter_instance.environment_variables)

        secret_provider_adapter_instance: SecretProviderAdapter = secret_provider_adapter(
            **{
                "logger": self.logger,
                "configuration": secret.configuration,
                "environment_variables": ev,
            }
        )

        await secret_provider_adapter_instance.add_secrets_to_env()
        environment_variables.update(**secret_provider_adapter_instance.environment_variables)


def get_secret_manager(
    logger: EntityLogger,
    integration_service: IntegrationService,
) -> SecretManager:
    """
    Factory function to create a SecretManager instance.

    Args:
        logger (EntityLogger): The logger instance.
        integration_service (IntegrationService): The integration service instance.

    Returns:
        SecretManager: An instance of SecretManager.
    """
    return SecretManager(
        logger=logger,
        integration_service=integration_service,
    )
