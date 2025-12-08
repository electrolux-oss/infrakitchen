import logging
import re
from typing import Any
from uuid import UUID


from core.audit_logs.handler import AuditLogHandler
from core.casbin.enforcer import CasbinEnforcer
from core.constants.model import ModelActions
from core.errors import EntityExistsError, EntityNotFound
from core.revisions.handler import RevisionHandler
from core.users.functions import user_entity_permissions
from core.utils.model_tools import is_valid_uuid
from .crud import PermissionCRUD
from core.users.service import UserService
from .schema import (
    ApiPolicyCreate,
    EntityPolicyCreate,
    PermissionCreate,
    PermissionResponse,
    RoleUsersResponse,
)
from core.users.model import UserDTO

logger = logging.getLogger(__name__)


class PermissionService:
    """
    PermissionService implements all required business-logic. It uses additional services and utils as helpers
    e.g. PermissionCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an event, etc
    """

    def __init__(
        self,
        crud: PermissionCRUD,
        revision_handler: RevisionHandler,
        audit_log_handler: AuditLogHandler,
        casbin_enforcer: CasbinEnforcer,
        user_service: UserService,
    ):
        self.crud: PermissionCRUD = crud
        self.user_service: UserService = user_service

        self.revision_handler: RevisionHandler = revision_handler
        self.audit_log_handler: AuditLogHandler = audit_log_handler
        self.casbin_enforcer: CasbinEnforcer = casbin_enforcer

    async def get_by_id(self, permission_id: str) -> PermissionResponse | None:
        if not is_valid_uuid(permission_id):
            raise ValueError("Invalid UUID format")

        permission = await self.crud.get_by_id(permission_id)
        if permission is None:
            return None

        result = PermissionResponse.model_validate(permission)
        return result

    async def get_all(self, **kwargs) -> list[PermissionResponse]:
        permissions = await self.crud.get_all(**kwargs)
        return [PermissionResponse.model_validate(permission) for permission in permissions]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    # Role methods
    async def count_roles(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count_roles(filter=filter)

    async def create_role(
        self, role_name: str, user_id: UUID | str, requester: UserDTO | None = None, reload_permission: bool = True
    ) -> PermissionResponse:
        if not re.match(r"^[a-z_]+$", role_name):
            raise ValueError("Role name must be a string of lowercase letters and (_)")

        if self.casbin_enforcer.enforcer is None:
            _ = await self.casbin_enforcer.get_enforcer()

        existing_role = await self.crud.get_all(filter={"ptype": "g", "v1": role_name})
        if existing_role:
            raise EntityExistsError(f"Role {role_name} already exists")

        user = await self.user_service.get_by_id(user_id)
        if user is None:
            raise EntityNotFound("User not found")

        permission = PermissionCreate(
            ptype="g",
            v0=f"user:{user.id}",
            v1=role_name,
            created_by=requester.id if requester else None,
        )

        new_role = await self.crud.create(permission.model_dump())
        result = await self.crud.get_by_id(new_role.id)

        if requester:
            await self.audit_log_handler.create_log(new_role.id, requester.id, ModelActions.CREATE)

        if reload_permission:
            await self.casbin_enforcer.send_reload_event()
        return PermissionResponse.model_validate(result)

    async def assign_user_to_role(
        self,
        role_name: str,
        user_id: UUID | str,
        requester: UserDTO | None = None,
        reload_permission: bool = True,
    ) -> PermissionResponse:
        if not re.match(r"^[a-z_]+$", role_name):
            raise ValueError("Role name must be a string of lowercase letters and (_)")

        if self.casbin_enforcer.enforcer is None:
            _ = await self.casbin_enforcer.get_enforcer()

        existing_assignment = await self.crud.get_all(filter={"ptype": "g", "v0": f"user:{user_id}", "v1": role_name})

        if existing_assignment:
            raise EntityExistsError(f"User {user_id} is already assigned to role {role_name}")

        user = await self.user_service.get_by_id(user_id)
        if user is None:
            raise EntityNotFound("User not found")

        existing_role = await self.crud.get_all(filter={"ptype": "g", "v1": role_name})
        if not existing_role:
            raise EntityNotFound(f"Role {role_name} not found")

        permission = PermissionCreate(
            ptype="g",
            v0=f"user:{user.id}",
            v1=role_name,
            created_by=requester.id if requester else None,
        )

        new_assignment = await self.crud.create(permission.model_dump())
        result = await self.crud.get_by_id(new_assignment.id)

        if requester:
            await self.audit_log_handler.create_log(new_assignment.id, requester.id, ModelActions.CREATE)

        if reload_permission:
            await self.casbin_enforcer.send_reload_event()
        return PermissionResponse.model_validate(result)

    async def get_all_roles(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
    ) -> list[PermissionResponse]:
        roles = await self.crud.get_all_roles(filter=filter, range=range)
        return [PermissionResponse.model_validate(role) for role in roles]

    async def get_role_api_permissions(
        self,
        role_name: str,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[PermissionResponse]:
        policies = await self.crud.get_api_policies_by_role(role_name, range=range, sort=sort)
        return [PermissionResponse.model_validate(policy) for policy in policies]

    async def get_users_by_role(self, role_name: str, **kwargs) -> list[RoleUsersResponse]:
        users = await self.crud.get_users_by_role(role_name, **kwargs)
        return [RoleUsersResponse.model_validate(user) for user in users]

    async def delete(self, permission_id: str, requester: UserDTO) -> None:
        if self.casbin_enforcer.enforcer is None:
            _ = await self.casbin_enforcer.get_enforcer()

        existing_permission = await self.crud.get_by_id(permission_id)
        if not existing_permission:
            raise EntityNotFound("Permission not found")

        await self.crud.delete(existing_permission)
        await self.casbin_enforcer.send_reload_event()
        await self.audit_log_handler.create_log(existing_permission.id, requester.id, ModelActions.DELETE)

    async def delete_entity_permissions(self, entity_name: str, entity_id: str | UUID) -> None:
        await self.crud.delete_entity_permissions(entity_name, entity_id)

    async def get_actions(self, role_id: str, requester: UserDTO) -> list[str]:
        """
        Get all actions available for the permission.
        :param role_id: ID of the role
        :return: List of actions
        """
        requester_permissions = await user_entity_permissions(requester, role_id)
        if "write" not in requester_permissions and "admin" not in requester_permissions:
            return []

        actions: list[str] = []
        role = await self.crud.get_by_id(role_id)
        if not role:
            raise EntityNotFound("Role not found")
        actions.append(ModelActions.EDIT)
        actions.append(ModelActions.DELETE)

        return actions

    # Entity permissions
    async def get_entity_permissions(self, entity_name: str, entity_id: str) -> list[PermissionResponse]:
        if not is_valid_uuid(entity_id):
            raise ValueError("Invalid entity ID format")

        policies = await self.crud.get_all(filter={"ptype": "p", "v1": f"{entity_name}:{entity_id}"})
        return [PermissionResponse.model_validate(policy) for policy in policies]

    # Api Policies
    async def create_api_policy(
        self,
        body: ApiPolicyCreate,
        requester: UserDTO | None = None,
        reload_permission: bool = True,
    ) -> PermissionResponse:
        if self.casbin_enforcer.enforcer is None:
            _ = await self.casbin_enforcer.get_enforcer()

        existing_policy = await self.crud.get_all(
            filter={
                "ptype": "p",
                "v0": body.role.lower(),
                "v1": f"api:{body.api}".lower(),
                "v2": body.action,
            }
        )
        if existing_policy:
            raise EntityExistsError(f"Api policy for {body.api} already exists")

        permission = PermissionCreate(
            ptype="p",
            v0=body.role.lower(),
            v1=f"api:{body.api}".lower(),
            v2=body.action,
            created_by=requester.id if requester else None,
        )

        new_permission = await self.crud.create(permission.model_dump())
        result = await self.crud.get_by_id(new_permission.id)

        if requester:
            await self.audit_log_handler.create_log(new_permission.id, requester.id, ModelActions.CREATE)

        if reload_permission:
            await self.casbin_enforcer.send_reload_event()

        return PermissionResponse.model_validate(result)

    async def create_entity_policy(
        self,
        body: EntityPolicyCreate,
        requester: UserDTO,
    ) -> PermissionResponse:
        if self.casbin_enforcer.enforcer is None:
            _ = await self.casbin_enforcer.get_enforcer()

        if body.role:
            existing_policy = await self.crud.get_all(
                filter={
                    "ptype": "p",
                    "v0": body.role.lower(),
                    "v1": f"{body.entity_name}:{body.entity_id}".lower(),
                    "v2": body.action,
                }
            )
        elif body.user_id:
            existing_policy = await self.crud.get_all(
                filter={
                    "ptype": "p",
                    "v0": f"user:{body.user_id}",
                    "v1": f"{body.entity_name}:{body.entity_id}".lower(),
                    "v2": body.action,
                }
            )
        else:
            raise ValueError("Either role or user_id must be provided")

        if existing_policy:
            raise EntityExistsError("Policy already exists")

        if body.role:
            existing_role = await self.crud.get_all(filter={"ptype": "g", "v1": body.role})
            if not existing_role:
                raise EntityNotFound(f"Role {body.role} not found")

            permission = PermissionCreate(
                ptype="p",
                v0=body.role.lower(),
                v1=f"{body.entity_name}:{body.entity_id}".lower(),
                v2=body.action,
                created_by=requester.id,
            )
        elif body.user_id:
            user = await self.user_service.get_by_id(body.user_id)
            if user is None:
                raise EntityNotFound("User not found")

            permission = PermissionCreate(
                ptype="p",
                v0=f"user:{user.id}",
                v1=f"{body.entity_name}:{body.entity_id}".lower(),
                v2=body.action,
                created_by=requester.id,
            )
        else:
            raise ValueError("Either role or user_id must be provided")

        # Update created_by and fetch updated object
        new_permission = await self.crud.create(permission.model_dump())
        result = await self.crud.get_by_id(new_permission.id)

        await self.audit_log_handler.create_log(new_permission.id, requester.id, ModelActions.CREATE)
        await self.casbin_enforcer.send_reload_event()

        return PermissionResponse.model_validate(result)
