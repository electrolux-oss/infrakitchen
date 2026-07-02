import uuid

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from application.workspaces.dependencies import get_workspace_service
from application.workspaces.schema import WorkspaceCreate, WorkspaceUpdate
from core.constants.model import ModelActions
from core.errors import AccessDenied
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.workspace.types import WorkspaceType


@strawberry_pydantic.input(model=WorkspaceCreate, all_fields=False)
class WorkspaceCreateInput:
    description: str = ""
    workspace_provider: str = strawberry.UNSET
    integration_id: uuid.UUID = strawberry.UNSET
    labels: list[str] = strawberry.field(default_factory=list)
    configuration: JSON | None = None


@strawberry_pydantic.input(model=WorkspaceUpdate, all_fields=False)
class WorkspaceUpdateInput:
    name: str | None = None
    description: str | None = None
    labels: list[str] | None = None


@strawberry.type
class WorkspaceMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_workspace(self, info: Info, input: WorkspaceCreateInput) -> WorkspaceType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_workspace_service(session)
        return await service.create_workspace(workspace=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_workspace(self, info: Info, id: uuid.UUID, input: WorkspaceUpdateInput) -> WorkspaceType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_workspace_service(session)

        if ModelActions.EDIT not in await service.get_actions(workspace_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.update_workspace(workspace_id=str(id), workspace=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_workspace(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_workspace_service(session)

        if ModelActions.DELETE not in await service.get_actions(workspace_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(workspace_id=str(id))
        return True
