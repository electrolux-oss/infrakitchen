import logging
from uuid import UUID
from typing import Any

from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions
from core.errors import DependencyError, EntityNotFound
from core.database import FieldSpec
from core.logs.service import LogService
from core.permissions.schema import EntityPolicyCreate, PermissionResponse
from core.permissions.service import PermissionService
from core.tasks.service import TaskEntityService
from core.utils.event_sender import EventSender
from core.utils.model_tools import has_field_changes, model_db_dump
from .crud import WorkspaceCRUD
from .functions import get_workspace_actions
from .model import Workspace
from .schema import (
    AzureDevOpsWorkspaceMeta,
    BitbucketWorkspaceMeta,
    GithubWorkspaceMeta,
    RoleWorkspacesResponse,
    UserWorkspaceResponse,
    WorkspaceCreate,
    WorkspaceMeta,
    WorkspaceResponse,
    WorkspaceUpdate,
)
from core.users.model import UserDTO


logger = logging.getLogger(__name__)


class WorkspaceService:
    """
    WorkspaceService implements all required business-logic. It uses additional services and utils as helpers
    e.g. WorkspaceCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an event, etc
    """

    def __init__(
        self,
        crud: WorkspaceCRUD,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
        log_service: LogService,
        task_service: TaskEntityService,
        permission_service: PermissionService,
    ):
        self.crud: WorkspaceCRUD = crud
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler
        self.log_service: LogService = log_service
        self.task_service: TaskEntityService = task_service
        self.permission_service: PermissionService = permission_service

    async def get_by_id(self, workspace_id: str | UUID) -> WorkspaceResponse | None:
        workspace = await self.crud.get_by_id(workspace_id)
        if workspace is None:
            return None
        return WorkspaceResponse.model_validate(workspace)

    async def get_all(self, **kwargs) -> list[WorkspaceResponse]:
        workspaces = await self.crud.get_all(**kwargs)
        return [WorkspaceResponse.model_validate(workspace) for workspace in workspaces]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def query_by_id(self, workspace_id: str | UUID, fields: FieldSpec | None = None) -> Workspace | None:
        """Return the ORM model directly, with optimized loading based on requested fields."""
        return await self.crud.get_by_id(workspace_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Workspace]:
        """Return ORM models directly, with optimized loading based on requested fields."""
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def get_actions(self, workspace_id: str | UUID, requester: UserDTO) -> list[str]:
        workspace = await self.crud.get_by_id(workspace_id)
        if not workspace:
            raise EntityNotFound("Workspace not found")
        return await get_workspace_actions(requester, workspace.id)

    async def create_workspace(self, workspace: WorkspaceCreate, requester: UserDTO) -> Workspace:
        """
        Create a new workspace and return the ORM model.
        :param workspace: WorkspaceCreate to create
        :param requester: User who creates the workspace
        :return: Created workspace ORM model
        """
        workspace_providers = ["github", "bitbucket", "azure_devops"]
        if workspace.workspace_provider not in workspace_providers:
            raise ValueError("Invalid workspace provider, must be one of 'github', 'bitbucket', or 'azure_devops'")

        body = model_db_dump(workspace)

        if isinstance(workspace.configuration, GithubWorkspaceMeta):
            configuration = WorkspaceMeta.from_github_meta(workspace.configuration)
            body["name"] = workspace.configuration.name
            body["configuration"] = model_db_dump(configuration)
        elif isinstance(workspace.configuration, BitbucketWorkspaceMeta):
            body["name"] = workspace.configuration.slug
            configuration = WorkspaceMeta.from_bitbucket_meta(workspace.configuration)
            body["configuration"] = model_db_dump(configuration)
        elif isinstance(workspace.configuration, AzureDevOpsWorkspaceMeta):
            body["name"] = workspace.configuration.name
            configuration = WorkspaceMeta.from_azure_devops_meta(workspace.configuration)
            body["configuration"] = model_db_dump(configuration)
        else:
            raise ValueError("Invalid workspace configuration type")

        body["created_by"] = requester.id
        new_workspace = await self.crud.create(body)
        result = await self.crud.get_by_id(new_workspace.id)
        if result is None:
            raise EntityNotFound("Workspace not found after creation")

        await self.audit_log_handler.create_log(new_workspace.id, requester.id, ModelActions.CREATE)
        await self.event_sender.send_event(WorkspaceResponse.model_validate(result), ModelActions.CREATE)
        await self.permission_service.create_entity_policy(
            EntityPolicyCreate(
                user_id=requester.id,
                entity_id=new_workspace.id,
                entity_name="workspace",
                action="admin",
            ),
            requester=requester,
            reload_permission=False,
        )
        await self.permission_service.casbin_enforcer.send_reload_event()
        return result

    async def update_workspace(self, workspace_id: str, workspace: WorkspaceUpdate, requester: UserDTO) -> Workspace:
        """
        Update an existing workspace and return the ORM model.
        :param workspace_id: ID of the workspace to update
        :param workspace: Workspace to update
        :param requester: User who updates the workspace
        :return: Updated workspace ORM model
        """
        body = model_db_dump(workspace, exclude_defaults=True, exclude_none=True)
        existing_workspace = await self.crud.get_by_id(workspace_id)

        if not existing_workspace:
            raise EntityNotFound("Workspace not found")

        if not has_field_changes(body, existing_workspace):
            raise ValueError("No changes detected; the workspace is already up to date.")

        await self.crud.update(existing_workspace, body)

        await self.audit_log_handler.create_log(existing_workspace.id, requester.id, ModelActions.UPDATE)
        await self.crud.refresh(existing_workspace)
        await self.event_sender.send_event(WorkspaceResponse.model_validate(existing_workspace), ModelActions.UPDATE)
        return existing_workspace

    async def delete(self, workspace_id: str) -> None:
        existing_workspace = await self.crud.get_by_id(workspace_id)
        if not existing_workspace:
            raise EntityNotFound("Workspace not found")

        dependencies = await self.crud.get_dependencies(existing_workspace)

        if dependencies:
            raise DependencyError(
                "Cannot delete a source_code that has dependencies",
                metadata=[
                    {
                        "id": dependency.id,
                        "name": dependency.name,
                        "_entity_name": dependency.type,
                    }
                    for dependency in dependencies
                ],
            )

        await self.audit_log_handler.create_log(
            existing_workspace.id, existing_workspace.created_by, ModelActions.DELETE
        )
        await self.log_service.delete_by_entity_id(workspace_id)
        await self.task_service.delete_by_entity_id(workspace_id)
        await self.permission_service.delete_entity_permissions("workspace", workspace_id)
        await self.crud.delete(existing_workspace)

    # Permissions
    async def get_user_workspace_policies(self, user_id: str) -> list[UserWorkspaceResponse]:
        policies = await self.crud.get_user_workspace_policies(user_id)
        return [UserWorkspaceResponse.model_validate(policy) for policy in policies]

    async def get_role_permissions(
        self,
        role_name: str,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[RoleWorkspacesResponse]:
        policies = await self.crud.get_workspace_policies_by_role(role_name, range=range, sort=sort)
        return [RoleWorkspacesResponse.model_validate(policy) for policy in policies]

    async def create_workspace_policy(
        self,
        workspace_policy: EntityPolicyCreate,
        requester: UserDTO,
    ) -> list[PermissionResponse]:
        workspace = await self.get_by_id(workspace_policy.entity_id)
        if not workspace:
            raise EntityNotFound(f"Workspace {workspace_policy.entity_id} not found")

        policies: list[PermissionResponse] = []
        policy = await self.permission_service.create_entity_policy(
            workspace_policy, requester, reload_permission=False
        )
        policies.append(PermissionResponse.model_validate(policy))
        await self.permission_service.casbin_enforcer.send_reload_event()
        return policies
