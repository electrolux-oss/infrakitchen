import logging
from typing import Any
from uuid import UUID

from application.executors.service import ExecutorService
from application.resources.service import ResourceService
from core.audit_logs.handler import AuditLogHandler
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import EntityNotFound, EntityWrongState
from core.tasks.service import TaskEntityService
from core.users.functions import user_api_permission
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import BatchOperationCRUD
from .schema import (
    BatchOperationCreate,
    BatchOperationResponse,
    BatchOperationResponseWithErrors,
)

logger = logging.getLogger(__name__)


class BatchOperationService:
    """
    BatchOperationService handles batch operations on multiple resources
    """

    def __init__(
        self,
        crud: BatchOperationCRUD,
        executor_service: ExecutorService,
        resource_service: ResourceService,
        task_service: TaskEntityService,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
    ):
        self.crud: BatchOperationCRUD = crud
        self.executor_service: ExecutorService = executor_service
        self.resource_service: ResourceService = resource_service
        self.task_service: TaskEntityService = task_service
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def get_by_id(self, batch_operation_id: str | UUID) -> BatchOperationResponse | None:
        entity = await self.crud.get_by_id(batch_operation_id)
        if not entity:
            return None
        return BatchOperationResponse.model_validate(entity)

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[BatchOperationResponse]:
        entities = await self.crud.get_all(filter=filter, range=range, sort=sort)
        return [BatchOperationResponse.model_validate(entity) for entity in entities]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def create(
        self,
        batch_operation: BatchOperationCreate,
        requester: UserDTO,
    ) -> BatchOperationResponse:
        """Create a batch operation and dispatch tasks to workers"""

        body = batch_operation.model_dump(exclude_unset=True)
        body["created_by"] = requester.id
        entity = await self.crud.create(body=body)
        return BatchOperationResponse.model_validate(entity)

    async def patch_action(
        self,
        batch_operation_id: str | UUID,
        body: PatchBodyModel,
        requester: UserDTO,
    ) -> BatchOperationResponseWithErrors:
        """Patch actions on a batch operation"""
        entity = await self.crud.get_by_id(batch_operation_id=batch_operation_id)
        if not entity:
            raise EntityNotFound(f"Batch operation {batch_operation_id} not found")

        if body.action not in [ModelActions.DRYRUN, ModelActions.EXECUTE]:
            raise ValueError(f"Unsupported action {body.action} for batch operation")

        pydantic_batch_operation = BatchOperationResponseWithErrors.model_validate(entity)
        await self.audit_log_handler.create_log(pydantic_batch_operation.id, requester.id, body.action)
        entities_with_errors: dict[UUID, str] = {}
        if pydantic_batch_operation.entity_type == "resource":
            for resource_id in pydantic_batch_operation.entity_ids:
                try:
                    await self.resource_service.patch_action(
                        resource_id=resource_id,
                        body=PatchBodyModel(action=body.action),
                        requester=requester,
                        trace_id=self.audit_log_handler.trace_id,
                    )
                except EntityWrongState as e:
                    entities_with_errors.update({resource_id: str(e)})
                    logger.warning(f"Resource {resource_id} skipped in batch operation {batch_operation_id}: {e}")

            pydantic_batch_operation.error_entity_ids = entities_with_errors
        elif pydantic_batch_operation.entity_type == "executor":
            for executor_id in pydantic_batch_operation.entity_ids:
                try:
                    await self.executor_service.patch_action(
                        executor_id=executor_id,
                        body=PatchBodyModel(action=body.action),
                        requester=requester,
                        trace_id=self.audit_log_handler.trace_id,
                    )
                except EntityWrongState as e:
                    entities_with_errors.update({executor_id: str(e)})
                    logger.warning(f"Executor {executor_id} skipped in batch operation {batch_operation_id}: {e}")

            pydantic_batch_operation.error_entity_ids = entities_with_errors
        else:
            raise ValueError(f"Unsupported entity type {pydantic_batch_operation.entity_type} for batch operation")

        return pydantic_batch_operation

    async def delete(
        self,
        batch_operation_id: str | UUID,
        requester: UserDTO,
    ) -> None:
        """Delete a batch operation"""
        entity = await self.crud.get_by_id(batch_operation_id=batch_operation_id)
        if not entity:
            raise EntityNotFound(f"Batch operation {batch_operation_id} not found")

        await self.crud.delete(batch_operation_id=batch_operation_id)

    async def get_actions(self, batch_operation_id: str, requester: UserDTO) -> list[str]:
        """
        Get all actions available for the source_code_version.
        :param source_code_version_id: ID of the source code version
        :return: List of actions
        """
        apis = await user_api_permission(requester, "batch_operation")
        if not apis:
            return []
        requester_permissions = [apis["api:batch_operation"]]

        batch_operation = await self.crud.get_by_id(batch_operation_id=batch_operation_id)
        if not batch_operation:
            raise EntityNotFound(f"Batch operation {batch_operation_id} not found")

        if "write" not in requester_permissions and "admin" not in requester_permissions:
            return []

        actions: list[str] = []
        if "admin" not in requester_permissions:
            return []

        actions.append(ModelActions.DELETE)
        actions.append(ModelActions.DRYRUN)
        actions.append(ModelActions.EXECUTE)

        return actions
