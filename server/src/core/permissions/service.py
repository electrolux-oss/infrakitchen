import logging
from typing import Any


from core.audit_logs.handler import AuditLogHandler
from core.casbin.enforcer import CasbinEnforcer
from core.constants.model import ModelActions
from core.errors import AccessDenied, EntityNotFound
from core.revisions.handler import RevisionHandler
from core.users.functions import user_entity_permissions, user_is_super_admin
from core.utils.model_tools import is_valid_uuid
from .crud import PermissionCRUD
from core.users.service import UserService
from .schema import (
    ApiPolicyRequest,
    PermissionCreate,
    PermissionResponse,
    ResourcePolicyRequest,
    ResourceUserPolicyRequest,
    UserRoleRequest,
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
        assert is_valid_uuid(permission_id), "Entity ID must be a valid UUID"
        permission = await self.crud.get_by_id(permission_id)
        if permission is None:
            return None

        if self.casbin_enforcer.enforcer is None:
            _ = await self.casbin_enforcer.get_enforcer()
        assert self.casbin_enforcer.enforcer is not None, "Casbin enforcer is not initialized"

        users = await self.casbin_enforcer.enforcer.get_users_for_role(permission.v1)
        result = PermissionResponse.model_validate(permission)
        result.users = users
        return result

    async def get_all(self, **kwargs) -> list[PermissionResponse]:
        permissions = await self.crud.get_all(**kwargs)
        return [PermissionResponse.model_validate(permission) for permission in permissions]

    async def get_all_subjects(self) -> list[str]:
        if self.casbin_enforcer.enforcer is None:
            _ = await self.casbin_enforcer.get_enforcer()
        assert self.casbin_enforcer.enforcer is not None, "Casbin enforcer is not initialized"

        enforcer = self.casbin_enforcer.enforcer
        result: list[str] = [sub for sub in enforcer.get_all_roles()]
        return result

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def create(self, body: PermissionCreate, requester: UserDTO) -> PermissionResponse:
        """
        Create a new permission based on the casbin_type logic.
        """
        if self.casbin_enforcer.enforcer is None:
            _ = await self.casbin_enforcer.get_enforcer()
        assert self.casbin_enforcer.enforcer is not None, "Casbin enforcer is not initialized"

        assert requester.id is not None, "Requester ID is required"

        if isinstance(body, UserRoleRequest):
            if await user_is_super_admin(requester) is False:
                raise AccessDenied("Access denied")

            user = await self.user_service.get_by_id(body.user_id)
            assert user is not None, "User not found"
            result = await self.crud.get_casbin_user_role_model(user.id, body.role.lower())
            assert result is None, "Role already exists"

            await self.casbin_enforcer.add_casbin_user_role(user.id, body.role.lower())

            result = await self.crud.get_casbin_user_role_model(user.id, body.role.lower())

        elif isinstance(body, ApiPolicyRequest):
            if await user_is_super_admin(requester) is False:
                raise AccessDenied("Access denied")

            result = await self.crud.get_casbin_policy_model(
                body.role.lower(), body.api.lower(), body.action, object_type="api"
            )
            assert result is None, "Policy already exists"

            await self.casbin_enforcer.add_casbin_policy(
                body.role.lower(), body.api.lower(), body.action, object_type="api"
            )

            result = await self.crud.get_casbin_policy_model(
                body.role.lower(), body.api.lower(), body.action, object_type="api"
            )

        elif isinstance(body, ResourcePolicyRequest):
            if (
                await self.casbin_enforcer.enforce_casbin_user(
                    requester.id, body.resource, "admin", object_type="resource"
                )
                is not True
            ):
                raise AccessDenied("Access denied")
            result = await self.crud.get_casbin_policy_model(
                body.role.lower(), body.resource.lower(), body.action, object_type="resource"
            )
            assert result is None, "Policy already exists"

            await self.casbin_enforcer.add_casbin_policy(
                body.role.lower(), body.resource.lower(), body.action, object_type="resource"
            )

            result = await self.crud.get_casbin_policy_model(
                body.role.lower(), body.resource.lower(), body.action, object_type="resource"
            )

        elif isinstance(body, ResourceUserPolicyRequest):
            if (
                await self.casbin_enforcer.enforce_casbin_user(
                    requester.id, body.resource, "admin", object_type="resource"
                )
                is not True
            ):
                raise AccessDenied("Access denied")

            user = await self.user_service.get_by_id(body.user_id)
            assert user is not None, "User not found"

            result = await self.crud.get_casbin_user_policy_model(
                user.id, body.resource.lower(), body.action, object_type="resource"
            )

            assert result is None, "Policy already exists"

            await self.casbin_enforcer.add_casbin_user_policy(
                user.id, body.resource.lower(), body.action, object_type="resource"
            )

            result = await self.crud.get_casbin_user_policy_model(
                user.id, body.resource.lower(), body.action, object_type="resource"
            )

        else:
            raise ValueError("Invalid casbin_type")

        # Update created_by and fetch updated object
        assert result is not None, "Permission was not created"
        new_permission = await self.crud.update(result, {"created_by": requester.id})
        result = await self.crud.get_by_id(new_permission.id)

        await self.audit_log_handler.create_log(new_permission.id, requester.id, ModelActions.CREATE)

        return PermissionResponse.model_validate(result)

    async def delete(self, permission_id: str, requester: UserDTO) -> None:
        if self.casbin_enforcer.enforcer is None:
            _ = await self.casbin_enforcer.get_enforcer()
        assert self.casbin_enforcer.enforcer is not None, "Casbin enforcer is not initialized"
        enforcer = self.casbin_enforcer.enforcer

        existing_permission = await self.crud.get_by_id(permission_id)
        if not existing_permission:
            raise EntityNotFound("Permission not found")

        if existing_permission.ptype == "g":
            assert await enforcer.delete_role_for_user(existing_permission.v0, existing_permission.v1) is True, (
                "Role not found"
            )
        elif existing_permission.ptype == "p":
            assert (
                await enforcer.remove_policy(existing_permission.v0, existing_permission.v1, existing_permission.v2)
                is True
            ), "Policy not found"
        else:
            raise ValueError("Invalid ptype")

        await self.casbin_enforcer.send_reload_event()
        await self.audit_log_handler.create_log(existing_permission.id, requester.id, ModelActions.DELETE)

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

    # User permissions
    async def get_user_roles(self, user_id: str) -> list[PermissionResponse]:
        roles = await self.crud.get_all(filter={"ptype": "g", "v0": f"user:{user_id}"})
        return [PermissionResponse.model_validate(role) for role in roles]

    async def get_user_policies(self, user_id: str) -> list[PermissionResponse]:
        policies = await self.crud.get_all(filter={"ptype": "p", "v0": f"user:{user_id}"})
        return [PermissionResponse.model_validate(policy) for policy in policies]

    # Role information
    async def get_all_roles(self) -> set[str]:
        roles = await self.crud.get_all(filter={"ptype": "g"})
        return set([role.v1 for role in roles if role.v1 is not None])

    async def get_role_permissions(self, role_name: str) -> list[PermissionResponse]:
        policies = await self.crud.get_all(filter={"ptype": "p", "v0": role_name})
        return [PermissionResponse.model_validate(policy) for policy in policies]

    # Entity permissions
    async def get_entity_permissions(self, entity_name: str, entity_id: str) -> list[PermissionResponse]:
        if not is_valid_uuid(entity_id):
            raise ValueError("Invalid entity ID format")

        policies = await self.crud.get_all(filter={"ptype": "p", "v1": f"{entity_name}:{entity_id}"})
        return [PermissionResponse.model_validate(policy) for policy in policies]
