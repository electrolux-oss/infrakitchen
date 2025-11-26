from datetime import datetime
from typing import Annotated, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from application.integrations.schema import IntegrationShort

from core.constants.model import ModelStatus
from core.models.encrypted_secret import EncryptedSecretStr
from core.users.schema import UserShort

secret_providers = Literal["aws", "gcp", "custom"]


class AWSSecretConfig(BaseModel):
    name: str = Field(..., frozen=True)
    aws_region: str = Field(..., frozen=True)
    secret_provider: Literal["aws"] = Field(default="aws", frozen=True)


class GCPSecretConfig(BaseModel):
    name: str = Field(..., frozen=True)
    gcp_region: str | None = Field(default=None, frozen=True)
    secret_provider: Literal["gcp"] = Field(default="gcp", frozen=True)


class CustomSecretValues(BaseModel):
    name: str = Field(...)
    value: EncryptedSecretStr = Field(...)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [(self.name, self.value)]


class CustomSecretConfig(BaseModel):
    secrets: list[CustomSecretValues] = Field(..., frozen=True)
    secret_provider: Literal["custom"] = Field(default="custom", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        result: list[tuple[str, EncryptedSecretStr]] = []
        for secret in self.secrets:
            result.extend(secret.get_secrets())
        return result


class SecretResponse(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    status: Literal[
        ModelStatus.DISABLED,
        ModelStatus.ENABLED,
    ] = Field(default=ModelStatus.ENABLED)

    revision_number: int = Field(default=1)
    creator: UserShort = Field()

    name: str = Field(...)
    description: str = Field(default="")
    secret_type: Literal["tofu"] = Field(..., frozen=True)
    secret_provider: secret_providers = Field(..., frozen=True)
    integration: IntegrationShort | None = Field(default=None)

    configuration: Annotated[
        AWSSecretConfig | GCPSecretConfig | CustomSecretConfig,
        Field(discriminator="secret_provider"),
    ] = Field(...)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "secret"


class SecretCreate(BaseModel):
    name: str = Field(...)
    description: str = Field(default="")
    secret_type: Literal["tofu"] = Field(..., frozen=True)
    secret_provider: secret_providers = Field(..., frozen=True)
    integration_id: uuid.UUID | str | None = Field(default=None, frozen=True)
    configuration: Annotated[
        AWSSecretConfig | GCPSecretConfig | CustomSecretConfig,
        Field(discriminator="secret_provider"),
    ] = Field(...)
    labels: list[str] = Field(default_factory=list)


class SecretUpdate(BaseModel):
    description: str | None = Field(default="")
    labels: list[str] = Field(default_factory=list)
    secret_provider: secret_providers | None = Field(default=None, frozen=True)
    configuration: (
        Annotated[
            AWSSecretConfig | GCPSecretConfig | CustomSecretConfig,
            Field(discriminator="secret_provider"),
        ]
        | None
    ) = Field(default=None)


class SecretShort(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(...)
    secret_type: Literal["tofu"] = Field(..., frozen=True)
    secret_provider: secret_providers = Field(..., frozen=True)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "secret"


class SecretValidationResponse(BaseModel):
    is_valid: bool = Field(default=False)
    message: str | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)
