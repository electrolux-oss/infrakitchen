from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field

from ..models.encrypted_secret import EncryptedSecretStr


class UserCreate(BaseModel):
    email: EmailStr | None = Field(default=None, title="Email")
    identifier: str = Field(..., title="Identifier", frozen=True)
    password: EncryptedSecretStr | None = Field(default=None, title="Password")
    first_name: str | None = Field(default=None, title="First name")
    last_name: str | None = Field(default=None, title="Last name")
    display_name: str | None = Field(default=None, title="Display name")
    deactivated: bool = Field(default=False, title="Deactivated")
    description: str | None = Field(default="", title="Description")


class UserCreateWithProvider(UserCreate):
    """
    UserCreateWithProvider is a request model for user creation with provider.
    It is used to create a new user with the specified provider by Auth provider.
    """

    provider: str = Field(..., title="Provider", frozen=True)


class UserResponse(BaseModel):
    """
    UserResponse is a response model for user.
    It is used to return user data to the client.
    """

    id: uuid.UUID = Field()
    email: EmailStr | None = Field(default=None, title="Email")
    identifier: str = Field(..., title="Identifier", frozen=True)
    first_name: str | None = Field(default=None, title="First name")
    last_name: str | None = Field(default=None, title="Last name")
    display_name: str | None = Field(default=None, title="Display name")
    provider: str = Field(..., title="Provider", frozen=True)
    is_primary: bool | None = Field(default=False, title="Is Primary")
    secondary_accounts: list["UserShort"] = Field(default_factory=list, title="Secondary accounts")
    primary_account: list["UserShort"] = Field(default_factory=list, title="Primary account for secondary users")
    deactivated: bool = Field(default=False, title="Deactivated")
    description: str | None = Field(default="", title="Description")
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "user"


class UserUpdate(BaseModel):
    password: EncryptedSecretStr | None = Field(default=None, title="Password")
    deactivated: bool | None = Field(default=None, title="Deactivated")
    description: str | None = Field(default="", title="Description")


class UserShort(BaseModel):
    """
    UserShort is a response model for user with minimal information.
    It is used to return user data to the client in a compact form.
    """

    id: uuid.UUID = Field(...)
    identifier: str = Field(..., title="Identifier", frozen=True)
    deactivated: bool = Field(default=False, title="Deactivated")
    display_name: str | None = Field(default=None, title="Display name")
    provider: str = Field(..., title="Provider", frozen=True)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "user"
