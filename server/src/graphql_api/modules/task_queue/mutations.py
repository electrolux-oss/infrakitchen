import logging
import uuid

import strawberry
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.types import Info

from core.errors import AccessDenied, EntityNotFound, EntityWrongState
from core.task_queue.crud import TaskQueueCRUD
from core.task_queue.model import TaskQueueStatus
from core.task_queue.service import TaskQueueService
from core.users.functions import user_entity_permissions, user_is_super_admin
from core.users.model import UserDTO
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.task_queue.types import ENTITY_DATA_LOADER, TaskQueueItemType

logger = logging.getLogger(__name__)


async def _can_cancel(requester: UserDTO, created_by: uuid.UUID | None, entity: str, entity_id: uuid.UUID) -> bool:
    """The user who requested the run, or an admin of its entity, may cancel it."""
    # Primary and secondary accounts are the same person
    linked_accounts = [*requester.primary_account, *requester.secondary_accounts]
    requester_ids = {requester.id, *(account.id for account in linked_accounts)}
    if created_by is not None and created_by in requester_ids:
        return True
    if "admin" in await user_entity_permissions(requester, entity_id, entity):
        return True
    return await user_is_super_admin(requester)


@strawberry.type
class TaskQueueMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def cancel_queued_task(self, info: Info, id: uuid.UUID) -> TaskQueueItemType:
        """Cancel a run that is still waiting in the queue, before any worker picks it up."""
        session: AsyncSession = info.context["session"]
        requester: UserDTO = info.context["request"].state.user
        service = TaskQueueService(crud=TaskQueueCRUD(session=session))

        task = await service.query_by_id(id)
        if task is None or task.entity_id is None:
            raise EntityNotFound("Queued task not found")
        if task.status != TaskQueueStatus.QUEUED:
            raise EntityWrongState(f"Task is {task.status} and can no longer be cancelled")

        # Tasks queued under another controller (e.g. a workspace sync) belong to the entity they point to
        entity = ENTITY_DATA_LOADER.get(task.entity, task.entity)
        if not await _can_cancel(requester, task.created_by, entity, task.entity_id):
            raise AccessDenied("Only the user who requested the task or an admin can cancel it")

        if await service.cancel_queued(id, reason=f"Cancelled by {requester.identifier}") is None:
            raise EntityWrongState("A worker has already picked up the task")

        await session.commit()
        logger.info(f"Queued task {id} ({task.entity} {task.entity_id} {task.action}) cancelled by {requester.id}")

        await session.refresh(task)
        return task  # pyright: ignore[reportReturnType]
