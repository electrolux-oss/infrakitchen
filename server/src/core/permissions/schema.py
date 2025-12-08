from datetime import datetime
import re
from typing import Literal, Self
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


from core.users.schema import UserShort
from core.utils.entities import get_all_entities

ActionLiteral = Literal["read", "write", "admin"]


class PermissionResponse(BaseModel):
    """
    CasbinRule model
    """

    id: uuid.UUID = Field(...)

    ptype: Literal["p", "g"] = Field(...)
    v0: str | None = Field(default=None)
    v1: str | None = Field(default=None)
    v2: str | None = Field(default=None)
    v3: str | None = Field(default=None)
    v4: str | None = Field(default=None)
    v5: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    creator: UserShort | None = Field(default=None)
    model_config = ConfigDict(
        from_attributes=True,
    )

    @computed_field
    def _entity_name(self) -> str:
        return "permission"


class PermissionCreate(BaseModel):
    ptype: Literal["p", "g"]
    v0: str | None = None
    v1: str | None = None
    v2: str | None = None
    v3: str | None = None
    v4: str | None = None
    v5: str | None = None
    created_by: uuid.UUID | None = None


class RoleCreate(BaseModel):
    user_id: uuid.UUID
    role: str

    @model_validator(mode="after")
    def validate_role_name(self) -> Self:
        pattern = r"^[a-z_]+$"
        if not re.fullmatch(pattern, self.role):
            raise ValueError(
                f"Role name '{self.role}' is invalid. It must contain only lowercase letters and underscores."
            )
        return self


class EntityPolicyCreate(BaseModel):
    role: str | None = None
    user_id: uuid.UUID | None = None
    entity_id: uuid.UUID
    entity_name: str
    action: ActionLiteral

    @model_validator(mode="after")
    def validate_role_name(self) -> Self:
        if self.role is None:
            return self

        pattern = r"^[a-z_]+$"
        if not re.fullmatch(pattern, self.role):
            raise ValueError(
                f"Role name '{self.role}' is invalid. It must contain only lowercase letters and underscores."
            )
        return self

    @model_validator(mode="after")
    def validate_role_or_user(self) -> Self:
        if self.role is None and self.user_id is None:
            raise ValueError("Either role or user_id must be provided.")
        if self.role is not None and self.user_id is not None:
            raise ValueError("Only one of role or user_id must be provided.")
        return self

    @model_validator(mode="after")
    def validate_entity_name(self) -> Self:
        if self.entity_name not in get_all_entities():
            raise ValueError(f"Entity name '{self.entity_name}' is invalid.")
        return self


class ApiPolicyCreate(BaseModel):
    role: str
    api: str
    action: ActionLiteral

    @model_validator(mode="after")
    def validate_role_name(self) -> Self:
        pattern = r"^[a-z_]+$"
        if not re.fullmatch(pattern, self.role):
            raise ValueError(
                f"Role name '{self.role}' is invalid. It must contain only lowercase letters and underscores."
            )
        return self


class RoleUsersResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    identifier: str
    email: str | None
    provider: str
    display_name: str | None
    role: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )
