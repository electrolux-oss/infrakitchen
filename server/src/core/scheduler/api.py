from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi import status as http_status

from .schema import SchedulerJobResponse, SchedulerJobCreate
from .service import SchedulerJobService
from .dependencies import get_scheduler_job_service
from core.users.functions import user_is_super_admin

router = APIRouter()


@router.get(
    "/scheduler/jobs",
    response_model=list[SchedulerJobResponse],
    response_description="Get all scheduler jobs",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(service: SchedulerJobService = Depends(get_scheduler_job_service)):
    return list(await service.get_all())


@router.post(
    "/scheduler/jobs",
    response_model=SchedulerJobResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def create(
    request: Request, body: SchedulerJobCreate, service: SchedulerJobService = Depends(get_scheduler_job_service)
):
    requester = request.state.user
    if not requester or not await user_is_super_admin(requester):
        raise HTTPException(status_code=403, detail="Access denied")

    return await service.create(job=body)
