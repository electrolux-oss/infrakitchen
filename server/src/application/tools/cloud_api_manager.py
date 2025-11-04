import logging

from application.integrations.model import IntegrationDTO
from core.adapters.provider_adapters import IntegrationProvider
from core.base_models import Base
from core.custom_entity_log_controller import EntityLogger

from core.errors import CannotProceed


logger = logging.getLogger(__name__)


class CloudApiManager:
    """
    Manager for handling cloud API operations in different cloud providers.
    """

    def __init__(
        self,
        model_instance: Base,
        logger: EntityLogger,
        workspace_root: str,
    ):
        self.model_instance: Base = model_instance
        self.logger: EntityLogger = logger
        self.workspace_root: str = workspace_root

    async def get_cloud_credentials(self, integration: IntegrationDTO, environment_variables: dict[str, str]):
        provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get(
            integration.integration_provider
        )
        if not provider_adapter:
            raise CannotProceed(f"Provider {integration.integration_provider} is not supported")
        self.logger.info(f"Authenticating with provider {integration.integration_provider}")
        provider_adapter_instance: IntegrationProvider = provider_adapter(
            **{"logger": self.logger, "configuration": integration.configuration}
        )
        await provider_adapter_instance.authenticate()
        environment_variables.update(**provider_adapter_instance.environment_variables)
