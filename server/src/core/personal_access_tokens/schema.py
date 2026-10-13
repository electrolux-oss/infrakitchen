from datetime import UTC, datetime, timedelta
import re
import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator


# Scope format: "<action>:<entity>" where action is read|write and entity is a
# bare API entity name (no trailing "s", no wildcards). Admin scope is not
# grantable to agent tokens.
_SCOPE_PATTERN = re.compile(r"^(read|write):[a-z_]+$")

# Agent tokens are short-lived by design: mandatory expiry, capped at 24h.
AGENT_TOKEN_MAX_TTL = timedelta(hours=24)


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
    token_type: str = Field(
        default="developer",
        description=(
            "'developer' (default) or 'agent'. Agent tokens must be scoped "
            "and expire; developer tokens default to unscoped and may be "
            "long-lived."
        ),
    )
    scopes: list[str] | None = Field(
        default=None,
        description=(
            "Granted scopes as '<read|write>:<entity>' entries. NULL/Omitted = "
            "full permissions of the owning user (developer tokens only; agent "
            "tokens require at least one scope). Agent tokens also require "
            "expires_at."
        ),
    )
    expires_at: datetime | None = Field(default=None)

    @model_validator(mode="before")
    @classmethod
    def normalize_token_type(cls, data: object) -> object:
        if isinstance(data, dict):
            token_type = data.get("token_type") or data.get("tokenType")
            data["token_type"] = token_type if token_type in ("developer", "agent") else "developer"
        return data

    @model_validator(mode="after")
    def validate_expiry(self):
        if self.expires_at is None:
            # Only agent tokens must expire; a scoped developer token may be
            # long-lived by the owner's choice.
            if self.token_type == "agent":
                raise ValueError("Agent tokens require an expiry date")
            return self

        expires_at = self.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)

        if expires_at <= datetime.now(UTC):
            raise ValueError("expires_at must be in the future")

        if self.token_type == "agent" and expires_at > datetime.now(UTC) + AGENT_TOKEN_MAX_TTL:
            raise ValueError("Agent tokens cannot expire more than 24 hours in the future")

        self.expires_at = expires_at
        return self

    @model_validator(mode="after")
    def validate_scopes(self):
        if self.token_type == "agent" and (self.scopes is None or len(self.scopes) == 0):
            raise ValueError("Agent tokens require at least one granted scope")
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
