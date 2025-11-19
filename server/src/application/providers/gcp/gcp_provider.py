import logging
from pathlib import Path
from tempfile import gettempdir
from typing import override

import aiofiles

from application.integrations.schema import GCPIntegrationConfig
from application.providers.gcp.gcp_project_client import GcpProjectClient
from core.adapters.provider_adapters import IntegrationProvider
from core.custom_entity_log_controller import EntityLogger
from core.errors import CloudWrongCredentials
from core.models.encrypted_secret import EncryptedSecretStr

log = logging.getLogger("gcp_integration")


class GcpAuthentication:
    environment_variables: dict[str, str]
    workspace_root: str | None = None
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        self.logger: logging.Logger | EntityLogger = logger if logger else log
        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for GcpAuthentication")

        if not isinstance(config, GCPIntegrationConfig):
            config = GCPIntegrationConfig.model_validate(config)

        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})
        self.gcp_service_account_key: EncryptedSecretStr | None = None
        self.gcp_project_id: str | None = None

        if isinstance(config, GCPIntegrationConfig):
            self.gcp_project_id = config.gcp_project_id
            self.gcp_service_account_key = config.gcp_service_account_key

    async def authenticate_gcp(self) -> None:
        if self.gcp_service_account_key and self.gcp_project_id:
            self.logger.info("Authenticating with Gcp using service account key...")
            if self.workspace_root:
                tmp_filename = Path(self.workspace_root) / "gcp_service_account_key.json"
            else:
                tmp_filename = Path(gettempdir()) / "gcp_service_account_key.json"
            async with aiofiles.open(tmp_filename, mode="w") as af:
                _ = await af.write(f"{self.gcp_service_account_key.get_decrypted_value().strip()}")

            self.environment_variables["GOOGLE_APPLICATION_CREDENTIALS"] = f"{tmp_filename}"
            self.environment_variables["GOOGLE_PROJECT"] = self.gcp_project_id
            self.logger.info(f"Service account key is written to {tmp_filename} for project {self.gcp_project_id}")
        else:
            self.logger.error("No valid authentication method provided for Gcp.")
            raise CloudWrongCredentials("No valid authentication method provided for Gcp.")


class GcpProvider(IntegrationProvider, GcpAuthentication):
    __integration_provider_name__: str = "gcp"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_gcp()

    @override
    async def is_valid(self) -> bool:
        gcp_project_client = GcpProjectClient(environment_variables=self.environment_variables)
        try:
            return await gcp_project_client.get_project() is not None
        except Exception as e:
            raise CloudWrongCredentials("Invalid Gcp credentials", metadata=[{"cloud_message": str(e)}]) from e
