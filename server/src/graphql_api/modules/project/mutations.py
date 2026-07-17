import uuid

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from application.projects.dependencies import get_project_service
from application.projects.schema import ProjectCreate, ProjectUpdate
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied
from core.users.functions import user_has_access_to_entity
from graphql_api.helpers import IsAuthenticated, check_api_permission
from graphql_api.modules.permission.mutations import EntityPolicyCreateInput
from graphql_api.modules.permission.types import PermissionType
from graphql_api.modules.project.types import ProjectType


@strawberry_pydantic.input(model=ProjectCreate, all_fields=True)
class ProjectCreateInput:
    name: str = strawberry.UNSET
    description: str = ""
    workspace_id: uuid.UUID | None = None
    configuration: JSON | None = None
    dependency_tags: JSON | None = None
    dependency_config: JSON | None = None
    labels: list[str] = strawberry.field(default_factory=list)
    owner_ids: list[uuid.UUID] = strawberry.field(default_factory=list)


@strawberry_pydantic.input(model=ProjectUpdate, all_fields=False)
class ProjectUpdateInput:
    name: str | None = None
    description: str | None = None
    workspace_id: uuid.UUID | None = None
    configuration: JSON | None = None
    dependency_tags: JSON | None = None
    dependency_config: JSON | None = None
    labels: list[str] | None = None
    owners: list[uuid.UUID] | None = None


@strawberry.input
class ProjectActionInput:
    action: str


@strawberry.type
class ProjectMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_project(self, info: Info, input: ProjectCreateInput) -> ProjectType:
        await check_api_permission(info, "project", ["admin"])
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_project_service(session)
        return await service.create_project(project=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_project(self, info: Info, id: uuid.UUID, input: ProjectUpdateInput) -> ProjectType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_project_service(session)

        if ModelActions.EDIT not in await service.get_actions(project_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.update_project(project_id=str(id), project=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def project_action(self, info: Info, id: uuid.UUID, input: ProjectActionInput) -> ProjectType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_project_service(session)

        actions_list = [action.value for action in ModelActions]
        if input.action not in actions_list:
            raise ValueError("Invalid action")

        if input.action not in await service.get_actions(project_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {input.action}")

        return await service.patch_action(
            project_id=str(id),
            body=PatchBodyModel(action=input.action),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_project(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_project_service(session)

        if ModelActions.DELETE not in await service.get_actions(project_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(project_id=str(id), requester=requester)
        return True

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_project_policy(self, info: Info, input: EntityPolicyCreateInput) -> list[PermissionType]:
        session = info.context["session"]
        requester = info.context["request"].state.user

        if not await user_has_access_to_entity(requester, input.entity_id, "admin", "project"):  # pyright: ignore
            raise AccessDenied("Access denied: admin access to project required")

        service = get_project_service(session)
        return await service.create_project_policy(
            project_policy=input.to_pydantic(),
            requester=requester,
        )
