import logging
from typing import override

from .mongo_atlas_client import MongoAtlasClient
from core.adapters.provider_adapters import IntegrationProvider
from core.custom_entity_log_controller import EntityLogger
from core.errors import CloudWrongCredentials
from core.models.encrypted_secret import EncryptedSecretStr
from ...integrations.schema import MongoDBAtlasIntegrationConfig

log = logging.getLogger("mongodb_atlas_provider")


class MongodbAtlasAuthentication:
    environment_variables: dict[str, str]
    workspace_root: str | None = None
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        self.logger: logging.Logger | EntityLogger = logger if logger else log

        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for MongodbAtlasAuthentication")
        configuration = MongoDBAtlasIntegrationConfig.model_validate(config)

        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})
        self.mongodb_atlas_org_id: str | None = configuration.mongodb_atlas_org_id
        self.mongodb_atlas_public_key: str | None = configuration.mongodb_atlas_public_key
        self.mongodb_atlas_private_key: EncryptedSecretStr | None = configuration.mongodb_atlas_private_key

    async def authenticate_mongodb(self) -> None:
        if self.mongodb_atlas_org_id and self.mongodb_atlas_public_key and self.mongodb_atlas_private_key:
            self.logger.info("Authenticating with MongoDB Atlas...")
            self.environment_variables["MONGODB_ATLAS_ORG_ID"] = self.mongodb_atlas_org_id
            self.environment_variables["MONGODB_ATLAS_PUBLIC_KEY"] = self.mongodb_atlas_public_key
            self.environment_variables["MONGODB_ATLAS_PRIVATE_KEY"] = (
                self.mongodb_atlas_private_key.get_decrypted_value()
            )
        else:
            self.logger.error("No valid authentication method provided for MongoDB Atlas.")
            raise CloudWrongCredentials("No valid authentication method provided for MongoDB Atlas.")


class MongodbAtlasProvider(IntegrationProvider, MongodbAtlasAuthentication):
    __integration_provider_name__: str = "mongodb_atlas"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_mongodb()

    @override
    async def is_valid(self) -> bool:
        mongodb_atlas_client = MongoAtlasClient(self.environment_variables)
        try:
            return await mongodb_atlas_client.get_organizations() is not None
        except Exception as e:
            raise CloudWrongCredentials("Failed to validate MongoDB Atlas connection.") from e
