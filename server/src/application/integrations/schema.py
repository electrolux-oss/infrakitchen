import re
import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field, field_validator, model_validator

from core import EncryptedSecretStr
from core.constants.model import ModelStatus
from core.users.schema import UserShort

integration_provider_type = Literal[
    "aws",
    "azurerm",
    "gcp",
    "azure_devops",
    "azure_devops_ssh",
    "github",
    "github_ssh",
    "bitbucket",
    "bitbucket_ssh",
    "mongodb_atlas",
    "datadog",
]


class AWSIntegrationConfig(BaseModel):
    aws_access_key_id: str = Field(...)
    aws_secret_access_key: EncryptedSecretStr = Field(...)
    aws_account: str = Field(..., frozen=True)
    aws_assumed_role_name: str | None = Field(default=None)
    integration_provider: Literal["aws"] = Field(default="aws", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("aws_secret_access_key", self.aws_secret_access_key)]


class GCPIntegrationConfig(BaseModel):
    gcp_service_account_key: EncryptedSecretStr = Field(...)
    gcp_project_id: str = Field(...)
    integration_provider: Literal["gcp"] = Field(default="gcp", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("gcp_service_account_key", self.gcp_service_account_key)]


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


class IntegrationResponse(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    status: Literal[
        ModelStatus.ENABLED,
        ModelStatus.DISABLED,
    ] = Field(default=ModelStatus.ENABLED)

    revision_number: int = Field(default=1)
    creator: UserShort = Field()

    name: str = Field(...)
    description: str = Field(default="")
    integration_type: Literal["cloud", "git"] = Field(..., frozen=True)
    integration_provider: integration_provider_type = Field(..., frozen=True)
    labels: list[str] = Field(default_factory=list)
    configuration: Annotated[
        AWSIntegrationConfig
        | GCPIntegrationConfig
        | AzureRMIntegrationConfig
        | AzureReposIntegrationConfig
        | AzureReposSshIntegrationConfig
        | MongoDBAtlasIntegrationConfig
        | GithubIntegrationConfig
        | GithubSshIntegrationConfig
        | BitbucketIntegrationConfig
        | BitbucketSshIntegrationConfig
        | DatadogIntegrationConfig,
        Field(discriminator="integration_provider"),
    ] = Field(...)

    model_config = ConfigDict(
        from_attributes=True,
    )

    @computed_field
    def _entity_name(self) -> str:
        return "integration"


class IntegrationCreate(BaseModel):
    name: str = Field(...)
    description: str = Field(default="")
    integration_type: Literal["cloud", "git"] = Field(..., frozen=True)
    integration_provider: integration_provider_type = Field(..., frozen=True)
    labels: list[str] = Field(default_factory=list)
    configuration: Annotated[
        AWSIntegrationConfig
        | GCPIntegrationConfig
        | AzureRMIntegrationConfig
        | AzureReposIntegrationConfig
        | AzureReposSshIntegrationConfig
        | MongoDBAtlasIntegrationConfig
        | GithubIntegrationConfig
        | GithubSshIntegrationConfig
        | BitbucketIntegrationConfig
        | BitbucketSshIntegrationConfig
        | DatadogIntegrationConfig,
        Field(discriminator="integration_provider"),
    ] = Field(...)

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
    labels: list[str] = Field(default_factory=list)
    configuration: (
        Annotated[
            AWSIntegrationConfig
            | GCPIntegrationConfig
            | AzureRMIntegrationConfig
            | AzureReposIntegrationConfig
            | AzureReposSshIntegrationConfig
            | MongoDBAtlasIntegrationConfig
            | GithubIntegrationConfig
            | GithubSshIntegrationConfig
            | BitbucketIntegrationConfig
            | BitbucketSshIntegrationConfig
            | DatadogIntegrationConfig,
            Field(discriminator="integration_provider"),
        ]
        | None
    ) = Field(default=None)


class IntegrationShort(BaseModel):
    id: uuid.UUID
    name: str
    integration_provider: integration_provider_type = Field(..., frozen=True)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "integration"


class IntegrationValidationRequest(BaseModel):
    integration_type: Literal["cloud", "git"] = Field(..., frozen=True)
    integration_provider: integration_provider_type = Field(..., frozen=True)

    configuration: Annotated[
        AWSIntegrationConfig
        | GCPIntegrationConfig
        | AzureRMIntegrationConfig
        | AzureReposIntegrationConfig
        | AzureReposSshIntegrationConfig
        | MongoDBAtlasIntegrationConfig
        | GithubIntegrationConfig
        | GithubSshIntegrationConfig
        | BitbucketIntegrationConfig
        | BitbucketSshIntegrationConfig
        | DatadogIntegrationConfig,
        Field(discriminator="integration_provider"),
    ] = Field(...)

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
