import json
import logging
from pathlib import Path
from tempfile import gettempdir
from typing import override

import aiofiles

from application.integrations.schema import GCPIntegrationConfig
from application.providers.gcp import gcp_oidc
from application.providers.gcp.gcp_project_client import GcpProjectClient, load_gcp_credentials_from_info
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
        self.integration_id: str | None = str(kwargs["integration_id"]) if kwargs.get("integration_id") else None
        self.gcp_auth_method: str = "service_account_key"
        self.gcp_service_account_key: EncryptedSecretStr | None = None
        self.gcp_wif_pool_provider_audience: str | None = None
        self.gcp_wif_service_account_email: str | None = None
        self.gcp_wif_service_account_impersonation_url: str | None = None
        self.gcp_oidc_subject: str | None = None
        self.gcp_oidc_signing_private_key: EncryptedSecretStr | None = None
        self.gcp_oidc_signing_public_jwk: str | None = None
        self.gcp_project_id: str | None = None

        if isinstance(config, GCPIntegrationConfig):
            self.gcp_auth_method = config.gcp_auth_method
            self.gcp_project_id = config.gcp_project_id
            self.gcp_service_account_key = config.gcp_service_account_key
            self.gcp_wif_pool_provider_audience = config.gcp_wif_pool_provider_audience
            self.gcp_wif_service_account_email = config.gcp_wif_service_account_email
            self.gcp_wif_service_account_impersonation_url = config.gcp_wif_service_account_impersonation_url
            self.gcp_oidc_subject = config.gcp_oidc_subject
            self.gcp_oidc_signing_private_key = config.gcp_oidc_signing_private_key
            self.gcp_oidc_signing_public_jwk = config.gcp_oidc_signing_public_jwk

    async def authenticate_gcp(self) -> None:
        if not self.gcp_project_id:
            self.logger.error("No valid authentication method provided for Gcp.")
            raise CloudWrongCredentials("No valid authentication method provided for Gcp.")

        credentials_dir = Path(self.workspace_root) if self.workspace_root else Path(gettempdir())

        if self.gcp_auth_method == "service_account_key" and self.gcp_service_account_key:
            self.logger.info("Authenticating with Gcp using service account key...")
            tmp_filename = credentials_dir / "gcp_service_account_key.json"
            credentials_value = self.gcp_service_account_key.get_decrypted_value().strip()
            credentials_label = "Service account key"
        elif self.gcp_auth_method == "workload_identity_federation_oidc":
            self.logger.info("Authenticating with Gcp using Workload Identity Federation (OIDC)...")
            tmp_filename = credentials_dir / "gcp_wif_credential_config.json"
            credentials_value = self._build_oidc_credential_config(credentials_dir)
            credentials_label = "WIF OIDC credential config"
        else:
            self.logger.error("No valid authentication method provided for Gcp.")
            raise CloudWrongCredentials("No valid authentication method provided for Gcp.")

        try:
            load_gcp_credentials_from_info(credentials_value)
        except json.JSONDecodeError as e:
            raise CloudWrongCredentials("Invalid Gcp credentials provided. Credentials must be valid JSON.") from e
        except Exception as e:
            raise CloudWrongCredentials("Error loading GCP credentials.") from e

        async with aiofiles.open(tmp_filename, mode="w") as af:
            _ = await af.write(credentials_value)

        self.environment_variables["GOOGLE_APPLICATION_CREDENTIALS"] = f"{tmp_filename}"
        self.environment_variables["GOOGLE_PROJECT"] = self.gcp_project_id
        self.logger.info(f"{credentials_label} is written to {tmp_filename} for project {self.gcp_project_id}")

    def _build_oidc_credential_config(self, credentials_dir: Path) -> str:
        """Mint the subject-token JWT, write it to disk, and build the external_account config JSON."""
        if not self.integration_id:
            raise CloudWrongCredentials("Integration id is required for GCP Workload Identity Federation via OIDC.")
        if not self.gcp_wif_pool_provider_audience:
            raise CloudWrongCredentials(
                "GCP Workload Identity pool provider audience is required for OIDC authentication."
            )
        if not self.gcp_oidc_signing_private_key or not self.gcp_oidc_signing_public_jwk:
            raise CloudWrongCredentials("GCP OIDC signing key is missing; re-save the integration to generate one.")

        private_key_pem = self.gcp_oidc_signing_private_key.get_decrypted_value()
        try:
            kid = json.loads(self.gcp_oidc_signing_public_jwk)["kid"]
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            raise CloudWrongCredentials("GCP OIDC signing public key is invalid.") from e

        try:
            issuer = gcp_oidc.issuer_url_for(self.integration_id)
        except ValueError as e:
            raise CloudWrongCredentials(str(e)) from e

        subject = self.gcp_oidc_subject or gcp_oidc.default_subject_for(self.integration_id)
        subject_token = gcp_oidc.mint_subject_token(
            private_key_pem=private_key_pem,
            kid=kid,
            issuer=issuer,
            audience=self.gcp_wif_pool_provider_audience,
            subject=subject,
        )

        subject_token_path = credentials_dir / "gcp_oidc_subject_token.jwt"
        subject_token_path.write_text(subject_token)

        config = gcp_oidc.build_external_account_config(
            audience=self.gcp_wif_pool_provider_audience,
            subject_token_path=str(subject_token_path),
            service_account_email=self.gcp_wif_service_account_email,
        )
        if self.gcp_wif_service_account_impersonation_url:
            config["service_account_impersonation_url"] = self.gcp_wif_service_account_impersonation_url
        return json.dumps(config)


class GcpProvider(IntegrationProvider, GcpAuthentication):
    __integration_provider_name__: str = "gcp"
    __integration_provider_type__: str = "cloud"
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
