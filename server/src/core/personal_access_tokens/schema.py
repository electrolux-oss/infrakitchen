from datetime import UTC, datetime
import re
import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator


# Scope format: "<action>:<entity>" where action is read|write and entity is a
# bare API entity name (no trailing "s", no wildcards). Admin scope is never
# grantable to a token.
_SCOPE_PATTERN = re.compile(r"^(read|write):[a-z_]+$")


def validate_scopes(scopes: list[str] | None) -> list[str] | None:
    if scopes is None:
        return None
    if not isinstance(scopes, list) or not scopes:
        raise ValueError("scopes must be a non-empty list when provided")
    normalized: list[str] = []
    for scope in scopes:
        if not isinstance(scope, str) or not _SCOPE_PATTERN.match(scope):
            raise ValueError(f"Invalid scope {scope!r}: expected '<read|write>:<entity>' (e.g. 'read:resource')")
        if scope not in normalized:
            normalized.append(scope)
    return normalized


class PersonalAccessTokenCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    scopes: list[str] | None = Field(
        default=None,
        description=(
            "Granted scopes as '<read|write>:<entity>' entries. NULL/Omitted = full permissions of the owning user."
        ),
    )
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

    @model_validator(mode="after")
    def validate_scopes(self):
        self.scopes = validate_scopes(self.scopes)
        return self


class PersonalAccessTokenResponse(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(...)
    token_prefix: str = Field(...)
    scopes: list[str] | None = Field(default=None)
    expires_at: datetime | None = Field(default=None)
    last_used_at: datetime | None = Field(default=None)
    revoked_at: datetime | None = Field(default=None)
    created_at: datetime = Field(...)

    model_config = ConfigDict(from_attributes=True)


class PersonalAccessTokenCreateResponse(PersonalAccessTokenResponse):
    token: str = Field(...)
