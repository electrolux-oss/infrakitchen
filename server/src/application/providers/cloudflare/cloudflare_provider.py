import logging
from typing import override

from application.integrations.schema import CloudflareIntegrationConfig
from .cloudflare_client import CloudflareClient
from core.adapters.provider_adapters import IntegrationProvider
from core.custom_entity_log_controller import EntityLogger
from core.errors import CloudWrongCredentials
from core.models.encrypted_secret import EncryptedSecretStr

log = logging.getLogger("cloudflare_provider")


class CloudflareAuthentication:
    environment_variables: dict[str, str]
    workspace_root: str | None = None
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        self.logger: logging.Logger | EntityLogger = logger if logger else log

        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for CloudflareAuthentication")
        configuration = CloudflareIntegrationConfig.model_validate(config)

        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})
        self.cloudflare_api_token: EncryptedSecretStr = configuration.cloudflare_api_token
        self.cloudflare_account_id: str | None = configuration.cloudflare_account_id

    async def authenticate_cloudflare(self) -> None:
        api_token = self.cloudflare_api_token.get_decrypted_value() if self.cloudflare_api_token else None
        if not api_token:
            self.logger.error("No valid authentication method provided for Cloudflare.")
            raise CloudWrongCredentials("No valid authentication method provided for Cloudflare.")

        self.logger.info("Authenticating with Cloudflare...")
        # read by the cloudflare/cloudflare OpenTofu provider (v4 and v5)
        self.environment_variables["CLOUDFLARE_API_TOKEN"] = api_token
        if self.cloudflare_account_id:
            self.environment_variables["CLOUDFLARE_ACCOUNT_ID"] = self.cloudflare_account_id
            # lets modules declare `variable "cloudflare_account_id" {}` without the user setting it;
            # a value from the resource variables (terraform.tfvars.json) still takes precedence
            self.environment_variables["TF_VAR_cloudflare_account_id"] = self.cloudflare_account_id


class CloudflareProvider(IntegrationProvider, CloudflareAuthentication):
    __integration_provider_name__: str = "cloudflare"
    __integration_provider_type__: str = "cloud"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_cloudflare()

    @override
    async def is_valid(self) -> bool:
        client = CloudflareClient(api_token=self.environment_variables.get("CLOUDFLARE_API_TOKEN", ""))
        try:
            token = await client.verify_token(account_id=self.cloudflare_account_id)
        except Exception as e:
            raise CloudWrongCredentials(
                "Cloudflare credentials are invalid.", metadata=[{"cloud_message": str(e)}]
            ) from e
        status = token.get("status")
        if status != "active":
            raise CloudWrongCredentials(
                f"Cloudflare API token is not active (status: {status}).",
                metadata=[{"cloud_message": f"token status: {status}"}],
            )
        return True
