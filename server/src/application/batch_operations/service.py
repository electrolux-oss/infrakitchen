import logging
from typing import Any
from uuid import UUID

from application.executors.service import ExecutorService
from application.resources.service import ResourceService
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions
from core.errors import EntityNotFound
from core.database import FieldSpec
from core.tasks.service import TaskEntityService
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import BatchOperationCRUD
from .functions import get_batch_operation_actions
from .model import BatchOperation
from .schema import (
    BatchOperationCreate,
    BatchOperationResponse,
    BatchOperationEntityIdsPatch,
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

    async def query_by_id(
        self, batch_operation_id: str | UUID, fields: FieldSpec | None = None
    ) -> BatchOperation | None:
        """Return the ORM model directly, with optimized loading based on requested fields."""
        return await self.crud.get_by_id(batch_operation_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[BatchOperation]:
        """Return ORM models directly, with optimized loading based on requested fields."""
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def get_actions(self, batch_operation_id: str | UUID, requester: UserDTO) -> list[str]:
        entity = await self.crud.get_by_id(batch_operation_id)
        if not entity:
            raise EntityNotFound("Batch operation not found")
        return await get_batch_operation_actions(requester)

    async def create_batch_operation(
        self,
        batch_operation: BatchOperationCreate,
        requester: UserDTO,
    ) -> BatchOperation:
        """Create a batch operation and return the ORM model."""
        body = batch_operation.model_dump(exclude_unset=True)
        body["created_by"] = requester.id
        return await self.crud.create(body=body)

    async def patch_entity_ids(
        self,
        batch_operation_id: str | UUID,
        body: BatchOperationEntityIdsPatch,
        requester: UserDTO,
    ) -> BatchOperation:
        """Patch entity_ids list on a batch operation and return the ORM model."""
        entity = await self.crud.get_by_id(batch_operation_id=batch_operation_id)
        if not entity:
            raise EntityNotFound(f"Batch operation {batch_operation_id} not found")

        await self.audit_log_handler.create_log(entity.id, requester.id, ModelActions.EDIT)

        existing_ids = list(entity.entity_ids or [])
        existing_ids_set = {str(value) for value in existing_ids}
        patch_ids_set = {str(value) for value in body.entity_ids}

        if body.action == "add":
            for entity_id in body.entity_ids:
                if str(entity_id) not in existing_ids_set:
                    existing_ids.append(entity_id)
                    existing_ids_set.add(str(entity_id))
        elif body.action == "remove":
            existing_ids = [value for value in existing_ids if str(value) not in patch_ids_set]

        entity.entity_ids = existing_ids
        return await self.crud.update(entity)

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
