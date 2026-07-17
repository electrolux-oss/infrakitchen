import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select

from application.resources.model import Resource
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from core.database import FieldSpec, to_dict
from core.errors import DependencyError, EntityWrongState, EntityNotFound
from core.permissions.model import Permission
from core.permissions.schema import EntityPolicyCreate
from core.permissions.service import PermissionService
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender
from core.utils.model_tools import has_field_changes, model_db_dump, to_json_serializable
from .functions import get_project_actions
from .crud import ProjectCRUD
from .model import Project
from .schema import ProjectCreate, ProjectResponse, ProjectUpdate
from core.users.model import UserDTO

from core.constants import ModelStatus

logger = logging.getLogger(__name__)


class ProjectService:
    """
    ProjectService implements all required business-logic for the Project entity.
    """

    def __init__(
        self,
        crud: ProjectCRUD,
        permission_service: PermissionService,
        revision_handler: RevisionHandler,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
    ):
        self.crud: ProjectCRUD = crud
        self.permission_service: PermissionService = permission_service
        self.revision_handler: RevisionHandler = revision_handler
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def get_by_id(self, project_id: str | UUID) -> ProjectResponse | None:
        project = await self.crud.get_by_id(project_id)
        if project is None:
            return None
        return ProjectResponse.model_validate(project)

    async def get_all(self, **kwargs) -> list[ProjectResponse]:
        projects = await self.crud.get_all(**kwargs)
        return [ProjectResponse.model_validate(project) for project in projects]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def query_by_id(self, project_id: str | UUID, fields: FieldSpec | None = None) -> Project | None:
        """Return the ORM model directly, with optimized loading based on requested fields."""
        return await self.crud.get_by_id(project_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Project]:
        """Return ORM models directly, with optimized loading based on requested fields."""
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def create_project(self, project: ProjectCreate, requester: UserDTO) -> Project:
        """
        Create a new project.
        :param project: ProjectCreate to create
        :param requester: User who creates the project
        :return: Created project
        """
        body = to_json_serializable(project.model_dump(exclude_unset=True))
        body["created_by"] = requester.id

        new_project = await self.crud.create(body)
        new_project.status = ModelStatus.ENABLED
        result = await self.crud.get_by_id(new_project.id)

        if not result:
            raise EntityNotFound("Project not found after creation")

        await self.revision_handler.handle_revision(new_project)
        await self.audit_log_handler.create_log(
            new_project.id, requester.id, ModelActions.CREATE, revision_number=new_project.revision_number
        )
        response = ProjectResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        return result

    async def update_project(self, project_id: str, project: ProjectUpdate, requester: UserDTO) -> Project:
        """
        Update an existing project.
        :param project_id: ID of the project to update
        :param project: ProjectUpdate data
        :param requester: User who updates the project
        :return: Updated project
        """
        existing_project = await self.crud.get_by_id(project_id)

        if not existing_project:
            raise EntityNotFound("Project not found")

        body = model_db_dump(project, exclude_defaults=True, exclude_none=True)

        if not has_field_changes(body, existing_project):
            raise ValueError("No changes detected; the project is already up to date.")

        self.revision_handler.original_entity_instance_dump = to_dict(existing_project)

        if existing_project.status == ModelStatus.DISABLED:
            existing_project.status = ModelStatus.ENABLED

        await self.crud.update(existing_project, body)

        await self.revision_handler.handle_revision(existing_project)
        await self.audit_log_handler.create_log(
            existing_project.id,
            requester.id,
            ModelActions.UPDATE,
            revision_number=existing_project.revision_number,
        )
        await self.crud.refresh(existing_project)
        response = ProjectResponse.model_validate(existing_project)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return existing_project

    async def patch_action(self, project_id: str, body: PatchBodyModel, requester: UserDTO) -> Project:
        """
        Patch an existing project (enable/disable).
        """
        existing_project = await self.crud.get_by_id(project_id)
        if not existing_project:
            raise EntityNotFound("Project not found")

        await self.audit_log_handler.create_log(
            existing_project.id, requester.id, body.action, revision_number=existing_project.revision_number
        )
        match body.action:
            case ModelActions.DISABLE:
                existing_project.status = ModelStatus.DISABLED
            case ModelActions.ENABLE:
                if existing_project.status == ModelStatus.DISABLED:
                    existing_project.status = ModelStatus.ENABLED
                else:
                    raise EntityWrongState("Project is already enabled")
            case _:
                raise ValueError("Invalid action")

        response = ProjectResponse.model_validate(existing_project)
        await self.event_sender.send_event(response, body.action)
        return existing_project

    async def delete(self, project_id: str, requester: UserDTO) -> None:
        existing_project = await self.crud.get_by_id(project_id)
        if not existing_project:
            raise EntityNotFound("Project not found")

        if existing_project.status == ModelStatus.ENABLED:
            raise EntityWrongState("Project must be disabled before deletion")

        # Check for assigned resources
        assigned_resources = list(
            (
                await self.crud.session.execute(
                    select(Resource.id, Resource.name).where(Resource.project_id == existing_project.id)
                )
            ).all()
        )
        if assigned_resources:
            raise DependencyError(
                message=f"Cannot delete project, it has {len(assigned_resources)} assigned resources",
                metadata=[
                    {"id": str(resource_id), "name": resource_name, "entityName": "resource"}
                    for resource_id, resource_name in assigned_resources
                ],
            )

        await self.audit_log_handler.create_log(project_id, requester.id, ModelActions.DELETE)
        await self.revision_handler.delete_revisions(project_id)
        await self.crud.delete(existing_project)

    async def get_actions(self, project_id: str | UUID, requester: UserDTO) -> list[str]:
        """
        Get all actions available for the project.
        """

        project = await self.crud.get_by_id(project_id, fields={"status": None, "owners": {"id": None}})
        if not project:
            raise EntityNotFound("Project not found")

        return await get_project_actions(requester, project_id, project.status, project)

    async def create_project_policy(
        self,
        project_policy: EntityPolicyCreate,
        requester: UserDTO,
    ) -> list[Permission]:
        project = await self.crud.get_by_id(project_policy.entity_id)
        if not project:
            raise EntityNotFound(f"Project {project_policy.entity_id} not found")

        policy = await self.permission_service.create_entity_policy(
            project_policy,
            requester,
            reload_permission=False,
        )
        await self.permission_service.casbin_enforcer.send_reload_event()
        return [policy]
