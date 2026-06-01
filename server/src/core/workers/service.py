from datetime import datetime
import logging
from typing import Any, Literal
from uuid import UUID

from core.database import FieldSpec
from core.utils.model_tools import model_db_dump
from core.workers.model import Worker, WorkerDTO

from .crud import WorkerCRUD
from .schema import WorkerResponse

logger = logging.getLogger(__name__)


class WorkerService:
    def __init__(
        self,
        crud: WorkerCRUD,
    ):
        self.crud: WorkerCRUD = crud

    async def get_by_id(self, entity_id: str) -> WorkerResponse | None:
        entity = await self.crud.get_by_id(entity_id)
        if entity is None:
            return None
        return WorkerResponse.model_validate(entity)

    async def get_all(self, **kwargs) -> list[WorkerResponse]:
        entities = await self.crud.get_all(**kwargs)
        return [WorkerResponse.model_validate(entity) for entity in entities]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def query_by_id(self, entity_id: str | UUID, fields: FieldSpec | None = None) -> Worker | None:
        """Return the ORM model directly, with optimized loading based on requested fields."""
        return await self.crud.get_by_id(entity_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Worker]:
        """Return ORM models directly, with optimized loading based on requested fields."""
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def save_worker(self, worker: WorkerDTO) -> WorkerDTO:
        result = await self.crud.get_all(filter={"name": worker.name, "host": worker.host})
        if result:
            # add id to worker model
            worker.id = result[0].id
            worker.updated_at = datetime.now()
            response = await self.crud.update(
                result[0],
                model_db_dump(worker, exclude_fields={"_entity_name", "created_at", "current_task", "tasks_completed"}),
            )
        else:
            response = await self.crud.create(model_db_dump(worker))

        await self.crud.commit()

        return WorkerDTO.model_validate(response)

    async def change_worker_status(self, worker_id: str | UUID, status: Literal["free", "busy"]) -> None:
        worker = await self.crud.get_by_id(str(worker_id))
        if not worker:
            logger.warning(f"Worker with id {worker_id} not found")
            return
        worker.status = status
        await self.crud.commit()

    async def set_current_task(self, worker_id: str | UUID | None, task_info: dict[str, str] | None) -> None:
        if worker_id is None:
            return
        worker = await self.crud.get_by_id(worker_id)
        if not worker:
            logger.warning(f"Worker with id {worker_id} not found")
            return
        worker.current_task = task_info
        await self.crud.commit()

    async def increment_tasks_completed(self, worker_id: str | UUID | None) -> None:
        if worker_id is None:
            return
        worker = await self.crud.get_by_id(worker_id)
        if not worker:
            logger.warning(f"Worker with id {worker_id} not found")
            return
        worker.tasks_completed = (worker.tasks_completed or 0) + 1
        await self.crud.commit()
