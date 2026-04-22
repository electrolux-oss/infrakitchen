import logging
from typing import Any
from uuid import UUID

from core.audit_logs.handler import AuditLogHandler
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions, ModelStatus
from core.errors import EntityNotFound, EntityWrongState
from core.revisions.handler import RevisionHandler
from core.users.functions import user_api_permission
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import WorkflowCRUD
from .schema import (
    WorkflowResponse,
    WorkflowStepResponse,
    WorkflowUpdate,
)

logger = logging.getLogger(__name__)


class WorkflowService:
    def __init__(
        self,
        crud: WorkflowCRUD,
        revision_handler: RevisionHandler,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
    ):
        self.crud = crud
        self.revision_handler = revision_handler
        self.event_sender = event_sender
        self.audit_log_handler = audit_log_handler

    async def create(
        self,
        body: dict[str, Any],
        requester: UserDTO,
    ) -> WorkflowResponse:
        workflow = await self.crud.create(body)
        await self.audit_log_handler.create_log(workflow.id, requester.id, ModelActions.CREATE)
        return WorkflowResponse.model_validate(workflow)

    async def get_by_id(self, workflow_id: str | UUID) -> WorkflowResponse | None:
        execution = await self.crud.get_by_id(workflow_id)
        if execution is None:
            return None
        return WorkflowResponse.model_validate(execution)

    async def get_all(self, **kwargs) -> list[WorkflowResponse]:
        resources = await self.crud.get_all(**kwargs)
        return [WorkflowResponse.model_validate(resource) for resource in resources]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def delete(self, workflow_id: str | UUID, requester: UserDTO) -> None:
        await self.crud.delete(workflow_id)
        await self.audit_log_handler.create_log(workflow_id, requester.id, ModelActions.DELETE)

    async def patch_action(self, workflow_id: str | UUID, body: PatchBodyModel, requester: UserDTO) -> WorkflowResponse:
        workflow = await self.crud.get_by_id(workflow_id)
        if not workflow:
            raise EntityNotFound("Execution not found")

        await self.audit_log_handler.create_log(workflow.id, requester.id, body.action)
        match body.action:
            case ModelActions.EXECUTE:
                await self.event_sender.send_task(
                    workflow.id,
                    requester=requester,
                    action=ModelActions.EXECUTE,
                )
            # case ModelActions.CANCEL:
            #     if execution.status in [ModelStatus.PENDING, ModelStatus.IN_PROGRESS]:
            #         execution.status = ModelStatus.CANCELLED
            #     else:
            #         raise EntityWrongState("Only pending or in-progress executions can be cancelled")
            case _:
                raise ValueError(f"Action {body.action} is not supported")

        return WorkflowResponse.model_validate(workflow)

    async def update(self, workflow_id: UUID, update_data: dict[str, Any]) -> WorkflowResponse:
        workflow = await self.crud.update(workflow_id, update_data)
        if workflow is None:
            raise EntityNotFound("Execution not found")
        return WorkflowResponse.model_validate(workflow)

    async def update_with_steps(
        self,
        workflow_id: str | UUID,
        request: WorkflowUpdate,
        requester: UserDTO,
    ) -> WorkflowResponse:
        """
        Update a pending workflow — edits each step's resolved variables / SCV
        / integrations / secrets / storage / parent resources. Only allowed
        while the workflow is still pending or in error state.
        """
        workflow = await self.crud.get_by_id(workflow_id)
        if workflow is None:
            raise EntityNotFound("Workflow not found")
        if workflow.status not in (ModelStatus.PENDING, ModelStatus.ERROR):
            raise EntityWrongState(
                f"Workflow cannot be edited in status {workflow.status}; only pending or error workflows are editable"
            )

        existing_step_ids = {step.id for step in workflow.steps}

        for step_update in request.steps or []:
            if step_update.id not in existing_step_ids:
                raise EntityNotFound(f"Step {step_update.id} does not belong to this workflow")
            data = step_update.model_dump(exclude_unset=True, exclude={"id"}, mode="json")
            if data:
                await self.crud.update_step(step_update.id, data)

        await self.audit_log_handler.create_log(workflow.id, requester.id, ModelActions.UPDATE)
        refreshed = await self.crud.get_by_id(workflow.id)
        response = WorkflowResponse.model_validate(refreshed)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return response

    async def update_step(self, step_id: UUID, update_data: dict[str, Any]) -> WorkflowStepResponse:
        step = await self.crud.update_step(step_id, update_data)
        if step is None:
            raise EntityNotFound("Execution step not found")
        return WorkflowStepResponse.model_validate(step)

    async def get_workflow_actions(self, workflow_id: str, requester: UserDTO) -> list[str]:
        apis = await user_api_permission(requester, "workflow")
        if not apis:
            return []
        requester_permissions = [apis.get("api:workflow", "")]

        actions: list[str] = []
        workflow = await self.crud.get_by_id(workflow_id)
        if not workflow:
            raise EntityNotFound("Workflow not found")

        if "write" in requester_permissions or "admin" in requester_permissions:
            actions.append(ModelActions.EXECUTE)

        if workflow.status in (ModelStatus.PENDING, ModelStatus.ERROR):
            if "write" in requester_permissions or "admin" in requester_permissions:
                actions.append(ModelActions.EDIT)

        if "admin" in requester_permissions:
            actions.append(ModelActions.DELETE)

        return actions
