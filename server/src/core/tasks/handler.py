import uuid

from core.constants.model import ModelState, ModelStatus
from core.users.model import UserDTO
from .model import TaskEntity
from .crud import TaskEntityCRUD


class TaskHandler:
    def __init__(self, crud: TaskEntityCRUD, entity_name: str, entity_id: str | uuid.UUID, user: UserDTO) -> None:
        self.crud: TaskEntityCRUD = crud
        self.task_instance: TaskEntity | None = None
        self.entity_name: str = entity_name
        self.entity_id: str | uuid.UUID = entity_id
        self.user: UserDTO = user

    async def create_task_if_not_exists(
        self,
        status: str,
        state: str | None = None,
    ) -> None:
        if self.task_instance:
            return None

        task = await self.crud.get_one(filter={"entity_id": self.entity_id})
        if task:
            self.task_instance = task
            return None

        new_task = dict(
            entity=self.entity_name,
            entity_id=self.entity_id,
            state=state,
            status=status,
            created_by=self.user.id,
        )
        self.task_instance = await self.crud.create(new_task)
        await self.crud.session.commit()

    async def update_task(self, status: ModelStatus, state: ModelState | None = None) -> None:
        if not self.task_instance:
            await self.create_task_if_not_exists(status=status, state=state)
            return None

        if state:
            self.task_instance.state = state

        if status:
            self.task_instance.status = status

        await self.save_task()

    async def save_task(self) -> None:
        if not self.task_instance:
            return None
        await self.crud.session.commit()
        await self.crud.session.refresh(self.task_instance)
