import uuid

import strawberry
from strawberry.experimental import pydantic as strawberry_pydantic
from strawberry.types import Info

from core.permissions.schema import (
    ApiPolicyCreate,
    EntityPolicyCreate,
    RoleCreate,
)
from core.permissions.dependencies import get_permission_service
from application.resources.dependencies import get_resource_service
from core.constants.model import ModelActions
from core.errors import AccessDenied
from core.users.functions import user_is_super_admin, user_has_access_to_entity
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.permission.types import PermissionType


@strawberry_pydantic.input(model=RoleCreate, all_fields=True)
class RoleCreateInput:
    user_id: uuid.UUID = strawberry.field()
    role: str = strawberry.field()


@strawberry_pydantic.input(model=ApiPolicyCreate)
class ApiPolicyCreateInput:
    role: str = strawberry.field()
    api: str = strawberry.field()
    action: str = strawberry.field()


@strawberry_pydantic.input(model=EntityPolicyCreate)
class EntityPolicyCreateInput:
    role: str | None = strawberry.field(default=None)
    user_id: uuid.UUID | None = strawberry.field(default=None)
    entity_id: uuid.UUID = strawberry.field()
    entity_name: str = strawberry.field()
    action: str = strawberry.field()
    inherits_children: bool = strawberry.field(default=False)


@strawberry.input
class AssignUserToRoleInput:
    role_id: str
    user_id: uuid.UUID


@strawberry.type
class PermissionMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_role(self, info: Info, input: RoleCreateInput) -> PermissionType:
        requester = info.context["request"].state.user
        session = info.context["session"]
        service = get_permission_service(session)

        if not await user_is_super_admin(requester):
            raise AccessDenied("Access denied: super admin required")

        return await service.create_role(
            role_name=input.to_pydantic().role,
            user_id=input.to_pydantic().user_id,
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def assign_user_to_role(self, info: Info, role_id: str, user_id: uuid.UUID) -> PermissionType:
        requester = info.context["request"].state.user
        session = info.context["session"]
        service = get_permission_service(session)

        if not await user_is_super_admin(requester):
            raise AccessDenied("Access denied: super admin required")

        # If role_id is UUID, fetch role name; else treat as role name
        role_name = role_id
        if isinstance(role_id, str) and len(role_id) == 36:  # UUID length
            try:
                uuid.UUID(role_id)
                role = await service.get_by_id(role_id)
                if not role:
                    raise AccessDenied("Role not found")
                role_name = role.v1
            except (ValueError, AttributeError):
                pass

        return await service.assign_user_to_role(
            role_name=str(role_name),
            user_id=user_id,
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_api_policy(self, info: Info, input: ApiPolicyCreateInput) -> PermissionType:
        requester = info.context["request"].state.user
        session = info.context["session"]
        service = get_permission_service(session)

        if not await user_is_super_admin(requester):
            raise AccessDenied("Access denied: super admin required")

        return await service.create_api_policy(
            body=input.to_pydantic(),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_entity_policy(self, info: Info, input: EntityPolicyCreateInput) -> PermissionType:
        requester = info.context["request"].state.user
        session = info.context["session"]
        service = get_permission_service(session)

        if not await user_has_access_to_entity(requester, input.entity_id, "admin", input.entity_name):  # pyright: ignore
            raise AccessDenied("Access denied: admin access to entity required")

        return await service.create_entity_policy(
            body=input.to_pydantic(),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_permission(self, info: Info, id: uuid.UUID) -> bool:
        requester = info.context["request"].state.user
        session = info.context["session"]
        service = get_permission_service(session)

        if ModelActions.DELETE not in await service.get_actions(str(id), requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(str(id), requester=requester)
        return True

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def cascade_delete_permission(self, info: Info, id: uuid.UUID) -> bool:
        requester = info.context["request"].state.user
        session = info.context["session"]
        permission_service = get_permission_service(session)

        if ModelActions.DELETE not in await permission_service.get_actions(str(id), requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        resource_service = get_resource_service(session)
        await resource_service.delete_resource_policy_cascade(str(id), requester=requester)
        return True
