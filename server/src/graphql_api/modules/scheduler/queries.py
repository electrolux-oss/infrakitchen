import strawberry
from strawberry.types import Info

from core.scheduler.dependencies import get_scheduler_job_service
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.scheduler.types import SchedulerJobType


@strawberry.type
class SchedulerQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def schedulers(self, info: Info) -> list[SchedulerJobType]:
        session = info.context["session"]
        service = get_scheduler_job_service(session=session)
        return [SchedulerJobType(**job.model_dump()) for job in await service.get_all()]
