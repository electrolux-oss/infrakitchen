import re
import uuid
from datetime import datetime, UTC
from typing import Annotated, Literal

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    computed_field,
    field_validator,
    model_validator,
)

from application.types import IntegrationProviderType, IntegrationType
from core.models.encrypted_secret import EncryptedSecretStr
from core.constants.model import ModelStatus
from core.users.schema import UserShort


class AWSIntegrationConfig(BaseModel):
    aws_access_key_id: str = Field(...)
    aws_secret_access_key: EncryptedSecretStr = Field(...)
    aws_account: str = Field(..., frozen=True)
    aws_assumed_role_name: str | None = Field(default=None)
    aws_session_duration: int | None = Field(default=3600)
    aws_default_region: str | None = Field(default="us-east-1")
    integration_provider: Literal["aws"] = Field(default="aws", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("aws_secret_access_key", self.aws_secret_access_key)]


class GCPIntegrationConfig(BaseModel):
    gcp_auth_method: Literal[
        "service_account_key",
        "workload_identity_federation_oidc",
    ] = Field(default="service_account_key")
    gcp_service_account_key: EncryptedSecretStr | None = Field(default=None)
    # Workload Identity Federation via InfraKitchen-issued OIDC tokens.
    # The full canonical provider resource name, used as the JWT `aud` and STS audience, e.g.
    # //iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID
    gcp_wif_pool_provider_audience: str | None = Field(default=None)
    # Optional service account to impersonate after federation. When omitted the federated
    # principal must be granted IAM roles directly.
    gcp_wif_service_account_email: str | None = Field(default=None)
    # Optional prebuilt IAMCredentials endpoint for service account impersonation. This keeps
    # compatibility with generic external_account JSON that already uses this exact field name.
    gcp_wif_service_account_impersonation_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "gcp_wif_service_account_impersonation_url",
            "service_account_impersonation_url",
        ),
    )
    # Optional JWT `sub` claim used for GCP attribute mapping. Defaults are derived at auth time.
    gcp_oidc_subject: str | None = Field(default=None)
    # Signing material generated server-side (never entered by the user). The private key signs the
    # subject token JWT; the public JWK is published at the JWKS endpoint / uploaded to GCP.
    gcp_oidc_signing_private_key: EncryptedSecretStr | None = Field(default=None)
    gcp_oidc_signing_public_jwk: str | None = Field(default=None)
    gcp_project_id: str = Field(...)
    integration_provider: Literal["gcp"] = Field(default="gcp", frozen=True)

    @field_validator("gcp_wif_pool_provider_audience")
    @classmethod
    def validate_gcp_wif_pool_provider_audience(cls, value: str | None) -> str | None:
        if value is None:
            return value

        if not value.startswith("//iam.googleapis.com/projects/"):
            raise ValueError(
                "GCP WIF pool provider audience must be the full provider resource name, e.g. "
                "//iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/"
                "workloadIdentityPools/POOL_ID/providers/PROVIDER_ID"
            )

        pattern = (
            r"^//iam\.googleapis\.com/projects/\d+/locations/global/"
            r"workloadIdentityPools/[^/]+/providers/[^/]+$"
        )
        if not re.fullmatch(pattern, value):
            raise ValueError(
                "GCP WIF pool provider audience must match "
                "//iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/"
                "workloadIdentityPools/POOL_ID/providers/PROVIDER_ID"
            )

        return value

    @field_validator("gcp_wif_service_account_impersonation_url")
    @classmethod
    def validate_gcp_wif_service_account_impersonation_url(cls, value: str | None) -> str | None:
        if value is None:
            return value

        pattern = (
            r"^https://iamcredentials\.googleapis\.com/v1/projects/-/serviceAccounts/"
            r"[^/:]+@[^/:]+\.iam\.gserviceaccount\.com:generateAccessToken$"
        )
        if not re.fullmatch(pattern, value):
            raise ValueError(
                "GCP WIF service account impersonation URL must match "
                "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"
                "SERVICE_ACCOUNT_EMAIL:generateAccessToken"
            )

        return value

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        secrets = []
        if self.gcp_service_account_key:
            secrets.append(("gcp_service_account_key", self.gcp_service_account_key))
        if self.gcp_oidc_signing_private_key:
            secrets.append(("gcp_oidc_signing_private_key", self.gcp_oidc_signing_private_key))
        return secrets

    @model_validator(mode="after")
    def validate_auth_method_configuration(self) -> "GCPIntegrationConfig":
        if self.gcp_auth_method == "service_account_key" and not self.gcp_service_account_key:
            raise ValueError("GCP service account key is required for service_account_key authentication")
        if self.gcp_auth_method == "workload_identity_federation_oidc" and not self.gcp_wif_pool_provider_audience:
            raise ValueError(
                "GCP Workload Identity pool provider audience is required for "
                "workload_identity_federation_oidc authentication"
            )
        return self


class AzureRMIntegrationConfig(BaseModel):
    client_id: str = Field(...)
    client_secret: EncryptedSecretStr = Field(...)
    tenant_id: str = Field(...)
    subscription_id: str = Field(...)
    integration_provider: Literal["azurerm"] = Field(default="azurerm", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("client_secret", self.client_secret)]


class AzureReposIntegrationConfig(BaseModel):
    azure_access_token: EncryptedSecretStr = Field(...)
    organization: str = Field(
        ...,
        frozen=True,
    )
    integration_provider: Literal["azure_devops"] = Field(default="azure_devops", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("azure_access_token", self.azure_access_token)]


class AzureReposSshIntegrationConfig(BaseModel):
    azure_ssh_private_key: EncryptedSecretStr = Field(...)
    integration_provider: Literal["azure_devops_ssh"] = Field(default="azure_devops_ssh", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("azure_ssh_private_key", self.azure_ssh_private_key)]


class MongoDBAtlasIntegrationConfig(BaseModel):
    mongodb_atlas_org_id: str = Field(...)
    mongodb_atlas_public_key: str = Field(...)
    mongodb_atlas_private_key: EncryptedSecretStr = Field(...)
    integration_provider: Literal["mongodb_atlas"] = Field(default="mongodb_atlas", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("mongodb_atlas_private_key", self.mongodb_atlas_private_key)]


class DatadogIntegrationConfig(BaseModel):
    datadog_api_url: str = Field(...)
    datadog_api_key: EncryptedSecretStr = Field(...)
    datadog_app_key: EncryptedSecretStr = Field(...)
    integration_provider: Literal["datadog"] = Field(default="datadog", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        secrets = []
        if self.datadog_api_key:
            secrets.append(("datadog_api_key", self.datadog_api_key))
        if self.datadog_app_key:
            secrets.append(("datadog_app_key", self.datadog_app_key))
        return secrets


class GithubIntegrationConfig(BaseModel):
    github_client_id: str | None = Field(default=None)
    github_client_secret: EncryptedSecretStr = Field(...)
    integration_provider: Literal["github"] = Field(default="github", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("github_client_secret", self.github_client_secret)] if self.github_client_secret else []


class GithubSshIntegrationConfig(BaseModel):
    github_ssh_private_key: EncryptedSecretStr = Field(...)
    integration_provider: Literal["github_ssh"] = Field(default="github_ssh", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("github_ssh_private_key", self.github_ssh_private_key)] if self.github_ssh_private_key else []


class GitLabIntegrationConfig(BaseModel):
    gitlab_server_url: str = Field(default="https://gitlab.com")
    gitlab_token: EncryptedSecretStr = Field(...)
    integration_provider: Literal["gitlab"] = Field(default="gitlab", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("gitlab_token", self.gitlab_token)] if self.gitlab_token else []


class BitbucketIntegrationConfig(BaseModel):
    bitbucket_user: EmailStr = Field(...)
    bitbucket_key: EncryptedSecretStr = Field(...)
    integration_provider: Literal["bitbucket"] = Field(default="bitbucket", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("bitbucket_key", self.bitbucket_key)] if self.bitbucket_key else []


class BitbucketSshIntegrationConfig(BaseModel):
    bitbucket_ssh_private_key: EncryptedSecretStr = Field(...)
    integration_provider: Literal["bitbucket_ssh"] = Field(default="bitbucket_ssh", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("bitbucket_ssh_private_key", self.bitbucket_ssh_private_key)] if self.bitbucket_ssh_private_key else []


class GitPublicIntegrationConfig(BaseModel):
    integration_provider: Literal["git_public"] = Field(default="git_public", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return []


class SlackIntegrationConfig(BaseModel):
    slack_bot_token: EncryptedSecretStr = Field(...)
    integration_provider: Literal["slack"] = Field(default="slack", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("slack_bot_token", self.slack_bot_token)] if self.slack_bot_token else []


type IntegrationConfigType = Annotated[
    AWSIntegrationConfig
    | GCPIntegrationConfig
    | AzureRMIntegrationConfig
    | AzureReposIntegrationConfig
    | AzureReposSshIntegrationConfig
    | MongoDBAtlasIntegrationConfig
    | GithubIntegrationConfig
    | GithubSshIntegrationConfig
    | GitLabIntegrationConfig
    | BitbucketIntegrationConfig
    | BitbucketSshIntegrationConfig
    | DatadogIntegrationConfig
    | GitPublicIntegrationConfig
    | SlackIntegrationConfig,
    Field(discriminator="integration_provider"),
]


class IntegrationResponse(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    status: Literal[
        ModelStatus.ENABLED,
        ModelStatus.DISABLED,
    ] = Field(default=ModelStatus.ENABLED)

    revision_number: int = Field(default=1)
    creator: UserShort = Field()

    name: str = Field(...)
    description: str = Field(default="")
    integration_type: IntegrationType = Field(..., frozen=True)
    integration_provider: IntegrationProviderType = Field(..., frozen=True)
    labels: list[str] = Field(default_factory=list)
    configuration: IntegrationConfigType = Field(...)

    model_config = ConfigDict(
        from_attributes=True,
    )

    @computed_field
    def _entity_name(self) -> str:
        return "integration"


class IntegrationCreate(BaseModel):
    name: str = Field(...)
    description: str = Field(default="")
    integration_type: IntegrationType = Field(..., frozen=True)
    integration_provider: IntegrationProviderType = Field(..., frozen=True)
    labels: list[str] = Field(default_factory=list)
    configuration: IntegrationConfigType = Field(...)

    @field_validator("integration_provider")
    @classmethod
    def validate_name_and_integration_provider(cls, value: str) -> str:
        pattern = r"[a-zA-Z0-9_]+"
        if not re.fullmatch(pattern, value):
            raise ValueError(f"field has to match pattern {pattern}")
        return value.lower()

    @model_validator(mode="after")
    def validate_provider_consistency(self) -> "IntegrationCreate":
        """
        Ensures the integration_provider field in the configuration object
        matches the top-level integration_provider field.
        """
        # Access the already validated fields
        config_provider = self.configuration.integration_provider
        root_provider = self.integration_provider

        if config_provider != root_provider:
            raise ValueError(
                f"Configuration provider '{config_provider}' must match the integration provider '{root_provider}'."
            )
        return self


class IntegrationUpdate(BaseModel):
    name: str | None = Field(default=None)
    description: str | None = Field(default=None)
    labels: list[str] | None = Field(default=None)
    configuration: IntegrationConfigType | None = Field(default=None)

    @model_validator(mode="before")
    @classmethod
    def at_least_one_field_present(cls, values):
        if not isinstance(values, dict):
            return values
        if not any(values.get(field) not in (None,) for field in IntegrationUpdate.model_fields):
            raise ValueError("At least one field must be provided in Integration update.")
        return values


class IntegrationShort(BaseModel):
    id: uuid.UUID
    name: str
    integration_provider: IntegrationProviderType = Field(..., frozen=True)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "integration"


class IntegrationValidationRequest(BaseModel):
    integration_type: IntegrationType = Field(..., frozen=True)
    integration_provider: IntegrationProviderType = Field(..., frozen=True)
    configuration: IntegrationConfigType = Field(...)

    @computed_field
    def _entity_name(self) -> str:
        return "integration_validation_request"


class IntegrationValidationResponse(BaseModel):
    is_valid: bool = Field(default=False)
    message: str | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "integration_validation_response"
