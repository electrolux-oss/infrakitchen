from datetime import UTC, datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PersonalAccessTokenCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    expires_at: datetime | None = Field(default=None)

    @model_validator(mode="after")
    def validate_expiry(self):
        if self.expires_at is None:
            return self

        expires_at = self.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)

        if expires_at <= datetime.now(UTC):
            raise ValueError("expires_at must be in the future")

        self.expires_at = expires_at
        return self


class PersonalAccessTokenResponse(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(...)
    token_prefix: str = Field(...)
    expires_at: datetime | None = Field(default=None)
    last_used_at: datetime | None = Field(default=None)
    revoked_at: datetime | None = Field(default=None)
    created_at: datetime = Field(...)

    model_config = ConfigDict(from_attributes=True)


class PersonalAccessTokenCreateResponse(PersonalAccessTokenResponse):
    token: str = Field(...)
