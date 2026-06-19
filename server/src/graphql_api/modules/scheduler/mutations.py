import uuid

import strawberry
from strawberry.experimental import pydantic as strawberry_pydantic
from strawberry.types import Info

from core.scheduler.dependencies import get_scheduler_job_service
from core.scheduler.schema import SchedulerJobCreate, SchedulerJobUpdate
from core.users.functions import user_is_super_admin
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.scheduler.types import SchedulerJobType


@strawberry_pydantic.input(model=SchedulerJobCreate, all_fields=False)
class SchedulerJobCreateInput:
    type: str = strawberry.UNSET
    script: str = strawberry.UNSET
    cron: str = strawberry.UNSET


@strawberry_pydantic.input(model=SchedulerJobUpdate, all_fields=False)
class SchedulerJobUpdateInput:
    type: str | None = strawberry.UNSET
    script: str | None = strawberry.UNSET
    cron: str | None = strawberry.UNSET


@strawberry.type
class SchedulerMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_scheduler(self, info: Info, input: SchedulerJobCreateInput) -> SchedulerJobType:
        requester = info.context["request"].state.user
        if not requester or not await user_is_super_admin(requester):
            raise PermissionError("Access denied")

        session = info.context["session"]
        service = get_scheduler_job_service(session=session)
        return SchedulerJobType(**(await service.create(job=input.to_pydantic())).model_dump())

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_scheduler(
        self,
        info: Info,
        id: uuid.UUID,
        input: SchedulerJobUpdateInput,
    ) -> SchedulerJobType | None:
        requester = info.context["request"].state.user
        if not requester or not await user_is_super_admin(requester):
            raise PermissionError("Access denied")

        session = info.context["session"]
        service = get_scheduler_job_service(session=session)
        job = await service.update(job_id=id, job=input.to_pydantic())
        return SchedulerJobType(**job.model_dump()) if job else None

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_scheduler(self, info: Info, id: uuid.UUID) -> bool:
        requester = info.context["request"].state.user
        if not requester or not await user_is_super_admin(requester):
            raise PermissionError("Access denied")

        session = info.context["session"]
        service = get_scheduler_job_service(session=session)
        return await service.delete(job_id=id)
