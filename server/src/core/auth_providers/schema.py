from datetime import datetime
from typing import Annotated, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from core.users.schema import UserShort
from ..models.encrypted_secret import EncryptedSecretStr


class MicrosoftProviderConfig(BaseModel):
    client_id: str = Field(...)
    client_secret: EncryptedSecretStr = Field(...)
    tenant_id: str = Field(...)
    redirect_uri: str = Field(...)
    auth_provider: Literal["microsoft"] = Field(default="microsoft", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("client_secret", self.client_secret)]


class GithubProviderConfig(BaseModel):
    auth_provider: Literal["github"] = Field(default="github", frozen=True)
    client_id: str = Field(...)
    client_secret: EncryptedSecretStr = Field(...)
    redirect_uri: str = Field(...)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("client_secret", self.client_secret)]


class GuestProviderConfig(BaseModel):
    auth_provider: Literal["guest"] = Field(default="guest", frozen=True)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return []


class BackstageProviderConfig(BaseModel):
    auth_provider: Literal["backstage"] = Field(default="backstage", frozen=True)
    backstage_private_key: EncryptedSecretStr | None = Field(default=None)
    backstage_jwks_url: str = Field(
        default="http://localhost:7007/api/auth/.well-known/jwks.json",
    )

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return [("backstage_private_key", self.backstage_private_key)] if self.backstage_private_key else []


class IKServiceAccountProviderConfig(BaseModel):
    auth_provider: Literal["ik_service_account"] = Field(default="ik_service_account", frozen=True)
    token_ttl: int = Field(default=3600)

    def get_secrets(self) -> list[tuple[str, EncryptedSecretStr]]:
        return []


class AuthProviderResponse(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    creator: UserShort | None = Field(default=None)

    name: str = Field(
        ...,
    )
    description: str = Field(default="")
    enabled: bool = Field(default=True)
    auth_provider: Literal["microsoft", "guest", "github", "backstage", "ik_service_account"] = Field(..., frozen=True)
    configuration: Annotated[
        MicrosoftProviderConfig
        | GithubProviderConfig
        | BackstageProviderConfig
        | GuestProviderConfig
        | IKServiceAccountProviderConfig,
        Field(discriminator="auth_provider"),
    ] = Field(...)

    filter_by_domain: list[str] = Field(default=[])

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "auth_provider"


class AuthProviderCreate(BaseModel):
    name: str = Field(
        ...,
    )
    description: str = Field(default="")
    enabled: bool = Field(default=True)
    auth_provider: Literal["microsoft", "guest", "github", "backstage", "ik_service_account"] = Field(..., frozen=True)
    configuration: Annotated[
        MicrosoftProviderConfig
        | GithubProviderConfig
        | BackstageProviderConfig
        | GuestProviderConfig
        | IKServiceAccountProviderConfig,
        Field(discriminator="auth_provider"),
    ] = Field(...)
    filter_by_domain: list[str] = Field(default=[])


class AuthProviderUpdate(BaseModel):
    name: str | None = Field(
        default=None,
    )
    description: str | None = Field(default=None)
    enabled: bool | None = Field(default=None)
    filter_by_domain: list[str] | None = Field(default=None)
    configuration: (
        None
        | Annotated[
            MicrosoftProviderConfig
            | GithubProviderConfig
            | BackstageProviderConfig
            | GuestProviderConfig
            | IKServiceAccountProviderConfig,
            Field(discriminator="auth_provider"),
        ]
    ) = Field(default=None)
