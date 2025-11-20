import logging
from typing import Any

from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions
from core.errors import DependencyError, EntityNotFound
from core.logs.service import LogService
from core.tasks.service import TaskEntityService
from core.users.functions import user_entity_permissions
from core.utils.event_sender import EventSender
from core.utils.model_tools import model_db_dump
from .crud import WorkspaceCRUD
from .schema import (
    AzureDevOpsWorkspaceMeta,
    BitbucketWorkspaceMeta,
    GithubWorkspaceMeta,
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
    ):
        self.crud: WorkspaceCRUD = crud
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler
        self.log_service: LogService = log_service
        self.task_service: TaskEntityService = task_service

    async def get_by_id(self, workspace_id: str) -> WorkspaceResponse | None:
        workspace = await self.crud.get_by_id(workspace_id)
        if workspace is None:
            return None
        return WorkspaceResponse.model_validate(workspace)

    async def get_all(self, **kwargs) -> list[WorkspaceResponse]:
        workspaces = await self.crud.get_all(**kwargs)
        return [WorkspaceResponse.model_validate(workspace) for workspace in workspaces]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def create(self, workspace: WorkspaceCreate, requester: UserDTO) -> WorkspaceResponse:
        """
        Create a new workspace.
        :param workspace: WorkspaceCreate to create
        :param requester: User who creates the workspace
        :return: Created workspace
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

        await self.audit_log_handler.create_log(new_workspace.id, requester.id, ModelActions.CREATE)
        response = WorkspaceResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        return response

    async def update(self, workspace_id: str, workspace: WorkspaceUpdate, requester: UserDTO) -> WorkspaceResponse:
        """
        Update an existing workspace.
        :param workspace_id: ID of the workspace to update
        :param workspace: Workspace to update
        :param requester: User who updates the workspace
        :return: Updated workspace
        """
        body = workspace.model_dump(exclude_unset=True)
        existing_workspace = await self.crud.get_by_id(workspace_id)

        if not existing_workspace:
            raise EntityNotFound("Workspace not found")

        await self.crud.update(existing_workspace, body)

        await self.audit_log_handler.create_log(existing_workspace.id, requester.id, ModelActions.UPDATE)
        response = WorkspaceResponse.model_validate(existing_workspace)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return response

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
        await self.crud.delete(existing_workspace)

    async def get_actions(self, workspace_id: str, requester: UserDTO) -> list[str]:
        """
        Get all actions available for the workspace.
        :param requester: Requesting user
        :param workspace_id: ID of the workspace
        :return: List of actions
        """
        requester_permissions = await user_entity_permissions(requester, workspace_id)
        if "write" not in requester_permissions and "admin" not in requester_permissions:
            return []

        actions: list[str] = []
        workspace = await self.crud.get_by_id(workspace_id)
        if not workspace:
            raise EntityNotFound("Source Code not found")

        if "admin" in requester_permissions:
            actions.append(ModelActions.DELETE)

        return actions
