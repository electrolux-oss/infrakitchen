from typing import Any
from uuid import UUID

from core.constants.model import ModelState, ModelStatus
from core.database import FieldSpec
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import TaskEntityCRUD
from .model import TaskEntity
from .schema import TaskEntityResponse, TaskScheduleCreate


class TaskEntityService:
    def __init__(
        self,
        crud: TaskEntityCRUD,
        event_sender: EventSender | None = None,
    ):
        self.crud: TaskEntityCRUD = crud
        self.event_sender = event_sender

    async def get_by_id(self, entity_id: str | UUID) -> TaskEntityResponse | None:
        entity = await self.crud.get_by_id(entity_id)
        if entity is None:
            return None
        return TaskEntityResponse.model_validate(entity)

    async def get_all(self, **kwargs) -> list[TaskEntityResponse]:
        entities = await self.crud.get_all(**kwargs)
        return [TaskEntityResponse.model_validate(entity) for entity in entities]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def query_by_id(self, entity_id: str | UUID, fields: FieldSpec | None = None) -> TaskEntity | None:
        return await self.crud.get_by_id(entity_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[TaskEntity]:
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def create_task_if_not_exists(
        self,
        entity_id: str | UUID,
        entity_name: str,
        requester: UserDTO,
        status: str,
        state: str | None = None,
    ) -> TaskEntity:
        task = await self.crud.get_one(filter={"entity_id": entity_id})
        if task:
            return task

        new_task = dict(
            entity=entity_name,
            entity_id=entity_id,
            state=state,
            status=status,
            created_by=requester.id,
        )
        task = await self.crud.create(new_task)
        return task

    async def update_task(
        self,
        entity_id: str | UUID,
        entity_name: str,
        requester: UserDTO,
        status: ModelStatus,
        state: ModelState | None = None,
    ) -> None:
        task = await self.create_task_if_not_exists(
            entity_id=entity_id,
            entity_name=entity_name,
            requester=requester,
            status=status,
            state=state,
        )

        if state:
            task.state = state

        if status:
            task.status = status

    async def delete_by_entity_id(self, entity_id: str) -> None:
        await self.crud.delete_by_entity_id(entity_id)

    async def _notify_reload(self) -> None:
        if self.event_sender is None:
            return
        await self.event_sender.send_reload_event("reload_scheduler_jobs")

    async def upsert_scheduled(self, scheduled_task: TaskScheduleCreate, requester: UserDTO) -> TaskEntity:
        existing_pending = await self.crud.get_one(
            filter={"entity_id": scheduled_task.entity_id, "entity": scheduled_task.entity}
        )

        if existing_pending is not None:
            updated = await self.crud.update(
                existing_pending,
                {
                    "run_at": scheduled_task.run_at,
                    "error": None,
                    "action": scheduled_task.action,
                    "status": ModelStatus.PENDING,
                    "state": None,
                },
            )
            await self._notify_reload()
            return updated

        created = await self.crud.create(
            {
                **scheduled_task.model_dump(),
                "created_by": requester.id,
                "state": None,
                "status": ModelStatus.PENDING,
                "error": None,
            }
        )
        await self._notify_reload()
        return created

    async def cancel_scheduled(self, task_id: UUID) -> TaskEntity | None:
        task = await self.crud.get_by_id(task_id)
        if task is None or task.run_at is None:
            return None

        if task.status != ModelStatus.PENDING:
            return task

        updated = await self.crud.update(task, {"status": ModelStatus.CANCELLED})
        await self._notify_reload()
        return updated
