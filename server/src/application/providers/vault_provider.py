import logging
import os
from typing import override

import aiofiles
from hvac import Client
from hvac.api.auth_methods import Kubernetes

from core import SecretProviderAdapter
from core.errors import CloudWrongCredentials
from ..integrations.schema import VaultIntegrationConfig

logger = logging.getLogger("vault_provider")


class VaultAuthentication:
    logger: logging.Logger = logger
    environment_variables: dict[str, str]

    def __init__(self, **kwargs) -> None:
        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for VaultAuthentication")
        configuration = VaultIntegrationConfig.model_validate(config)

        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})
        self.vault_token: str | None = configuration.vault_token.get_decrypted_value()
        self.vault_domain: str = configuration.vault_domain
        self.vault_client: Client | None = None

        if not self.vault_domain:
            self.logger.error("No valid vault domain provided.")
            raise ValueError("No valid vault domain provided.")

    async def get_vault_client(self):
        if os.getenv("ENV") == "testing":
            # disable for tests
            pass
        elif os.getenv("ENV") == "production":
            self.vault_client = Client(self.vault_domain)
            async with aiofiles.open("/var/run/secrets/kubernetes.io/serviceaccount/token") as f:
                jwt = await f.read()
            mount_point = os.getenv("VAULT_MOUNT_POINT")
            assert mount_point, "VAULT_MOUNT_POINT is not set"
            Kubernetes(self.vault_client.adapter).login(role="infra", jwt=jwt, mount_point=mount_point)
        else:
            self.vault_client = Client(self.vault_domain, token=self.vault_token)

    async def get_token(self) -> None:
        if not self.vault_token:
            self.logger.info("Fetching vault token...")

            if not self.vault_client:
                await self.get_vault_client()
            self.vault_token = self.vault_client.token if self.vault_client else None

        if not self.vault_token:
            self.logger.error("No valid vault token provided.")
            raise ValueError("No valid vault token provided.")

        self.environment_variables["VAULT_TOKEN"] = self.vault_token
        self.environment_variables["VAULT_ADDR"] = self.vault_domain
        self.logger.info("Fetched vault token")


class VaultProviderAdapter(SecretProviderAdapter, VaultAuthentication):
    __secret_provider_adapter_name__: str = "vault"
    logger: logging.Logger = logger

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.get_token()

    async def lookup_token(self):
        if not self.vault_client:
            await self.get_vault_client()
        if not self.vault_client:
            raise ValueError("Vault client is not initialized")
        return self.vault_client.auth.token.lookup_self()

    @override
    async def is_valid(self) -> bool:
        try:
            return await self.lookup_token() is not None
        except Exception as e:
            raise CloudWrongCredentials(f"Validation failed: {e}") from e
