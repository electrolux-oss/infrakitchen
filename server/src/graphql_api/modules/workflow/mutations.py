import uuid
from typing import Any

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.workflows.dependencies import get_workflow_service
from application.workflows.schema import (
    WorkflowStepUpdate,
    WorkflowUpdate,
)
from application.workflows.service import WorkflowService
from core.constants.model import ModelActions
from core.errors import AccessDenied
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.workflow.types import WorkflowType


@strawberry.input
class WorkflowStepUpdateInput:
    id: uuid.UUID
    resolved_variables: JSON | None = strawberry.UNSET
    parent_resource_ids: list[uuid.UUID] | None = strawberry.UNSET
    source_code_version_id: uuid.UUID | None = strawberry.UNSET
    integration_ids: list[uuid.UUID] | None = strawberry.UNSET
    secret_ids: list[uuid.UUID] | None = strawberry.UNSET
    storage_id: uuid.UUID | None = strawberry.UNSET

    def to_step_update(self) -> WorkflowStepUpdate:
        data: dict[str, Any] = {"id": self.id}
        if self.resolved_variables is not strawberry.UNSET:
            data["resolved_variables"] = self.resolved_variables
        if self.parent_resource_ids is not strawberry.UNSET:
            data["parent_resource_ids"] = self.parent_resource_ids
        if self.source_code_version_id is not strawberry.UNSET:
            data["source_code_version_id"] = self.source_code_version_id
        if self.integration_ids is not strawberry.UNSET:
            data["integration_ids"] = self.integration_ids
        if self.secret_ids is not strawberry.UNSET:
            data["secret_ids"] = self.secret_ids
        if self.storage_id is not strawberry.UNSET:
            data["storage_id"] = self.storage_id
        return WorkflowStepUpdate(**data)


@strawberry.input
class WorkflowUpdateInput:
    steps: list[WorkflowStepUpdateInput] | None = strawberry.UNSET


def _build_service(info: Info) -> WorkflowService:
    session = info.context["session"]
    return get_workflow_service(session=session)


@strawberry.type
class WorkflowMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_workflow(self, info: Info, id: uuid.UUID, input: WorkflowUpdateInput) -> WorkflowType:
        requester = info.context["request"].state.user
        service = _build_service(info)

        if ModelActions.EDIT not in await service.get_actions(workflow_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT}")

        steps = [step.to_step_update() for step in input.steps] if input.steps else None
        request = WorkflowUpdate(steps=steps)
        return await service.update_with_steps_orm(workflow_id=id, request=request, requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_workflow(self, info: Info, id: uuid.UUID) -> bool:
        requester = info.context["request"].state.user
        service = _build_service(info)

        if ModelActions.DELETE not in await service.get_actions(workflow_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE}")

        await service.delete(workflow_id=id, requester=requester)
        return True
