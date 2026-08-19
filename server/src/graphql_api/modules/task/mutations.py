import uuid
from datetime import datetime

import strawberry
from strawberry.experimental import pydantic as strawberry_pydantic
from strawberry.types import Info

from application.executors.dependencies import get_executor_service
from application.favorites.dependencies import get_favorite_service
from application.resources.dependencies import get_resource_service
from core.constants.model import ModelActions
from core.errors import AccessDenied
from core.errors import EntityNotFound
from core.tasks.dependencies import get_task_service
from core.tasks.schema import TaskScheduleCreate
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.task.types import TaskType


@strawberry_pydantic.input(model=TaskScheduleCreate, all_fields=False)
class ScheduledEntityActionCreateInput:
    entity_id: uuid.UUID = strawberry.UNSET
    entity: str = strawberry.UNSET
    action: str = strawberry.UNSET
    run_at: datetime = strawberry.UNSET


@strawberry.type
class TaskMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def schedule_entity_action(
        self,
        info: Info,
        input: ScheduledEntityActionCreateInput,
    ) -> TaskType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        task_service = get_task_service(session=session)
        schedule = TaskScheduleCreate(
            entity_id=input.entity_id,  # pyright: ignore[reportAttributeAccessIssue]
            entity=input.entity,  # pyright: ignore[reportAttributeAccessIssue]
            action=ModelActions(input.action),  # pyright: ignore[reportAttributeAccessIssue]
            run_at=input.run_at,  # pyright: ignore[reportAttributeAccessIssue]
        )

        match schedule.entity:
            case "resource":
                service = get_resource_service(session=session)
                if ModelActions.EXECUTE not in await service.get_actions(
                    resource_id=schedule.entity_id, requester=requester
                ):
                    raise AccessDenied(f"Access denied for action {ModelActions.EXECUTE.value}")
            case "executor":
                service = get_executor_service(
                    session=session,
                    favorite_service=get_favorite_service(session=session),
                )
                if ModelActions.EXECUTE not in await service.get_actions(
                    executor_id=schedule.entity_id, requester=requester
                ):
                    raise AccessDenied(f"Access denied for action {ModelActions.EXECUTE.value}")
            case _:
                raise EntityNotFound(f"Unsupported entity type: {schedule.entity}")

        return await task_service.upsert_scheduled(schedule, requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def cancel_scheduled_entity_action(
        self,
        info: Info,
        id: uuid.UUID,
    ) -> TaskType | None:
        session = info.context["session"]
        requester = info.context["request"].state.user
        task_service = get_task_service(session=session)
        task = await task_service.get_by_id(id)
        if task is None:
            return None

        match task.entity:
            case "resource":
                service = get_resource_service(session=session)
                if ModelActions.EXECUTE not in await service.get_actions(
                    resource_id=task.entity_id, requester=requester
                ):
                    raise AccessDenied(f"Access denied for action {ModelActions.EXECUTE.value}")
            case "executor":
                service = get_executor_service(
                    session=session,
                    favorite_service=get_favorite_service(session=session),
                )
                if ModelActions.EXECUTE not in await service.get_actions(
                    executor_id=task.entity_id, requester=requester
                ):
                    raise AccessDenied(f"Access denied for action {ModelActions.EXECUTE.value}")
            case _:
                raise EntityNotFound(f"Unsupported entity type: {task.entity}")

        cancelled = await task_service.cancel_scheduled(id)
        return cancelled
