from datetime import datetime
from typing import Annotated, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field


from core.users.schema import UserShort


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
    users: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    creator: UserShort | None = Field(default=None)
    model_config = ConfigDict(
        from_attributes=True,
    )

    @computed_field
    def _entity_name(self) -> str:
        return "permission"


class UserRoleRequest(BaseModel):
    casbin_type: Literal["user_role"]
    user_id: uuid.UUID
    role: str


class ApiPolicyRequest(BaseModel):
    casbin_type: Literal["api_policy"]
    role: str
    api: str
    action: str


class ResourcePolicyRequest(BaseModel):
    casbin_type: Literal["resource_policy"]
    role: str
    resource: str
    action: str


class ResourceUserPolicyRequest(BaseModel):
    casbin_type: Literal["resource_user_policy"]
    user_id: uuid.UUID
    resource: str
    action: str


PermissionCreate = Annotated[
    UserRoleRequest | ApiPolicyRequest | ResourcePolicyRequest | ResourceUserPolicyRequest,
    Field(discriminator="casbin_type"),
]
