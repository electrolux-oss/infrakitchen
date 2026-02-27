from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi import status as http_status
from uuid import UUID
from infrakitchen_mcp.dispatch_framework import list_entities_group
from infrakitchen_mcp.registry import mcp_group

from .schema import SchedulerJobResponse, SchedulerJobCreate, SchedulerJobUpdate
from .service import SchedulerJobService
from .dependencies import get_scheduler_job_service
from core.users.functions import user_is_super_admin

router = APIRouter()


@router.get(
    "/schedulers",
    response_model=list[SchedulerJobResponse],
    response_description="Get all scheduler jobs",
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(list_entities_group, "scheduler_jobs")
async def get_all(service: SchedulerJobService = Depends(get_scheduler_job_service)):
    return list(await service.get_all())


@router.post(
    "/schedulers",
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


@router.patch(
    "/schedulers/{job_id}",
    response_model=SchedulerJobResponse,
    status_code=http_status.HTTP_200_OK,
)
async def update(
    request: Request,
    job_id: UUID,
    body: SchedulerJobUpdate,
    service: SchedulerJobService = Depends(get_scheduler_job_service),
):
    requester = request.state.user
    if not requester or not await user_is_super_admin(requester):
        raise HTTPException(status_code=403, detail="Access denied")

    job = await service.update(job_id=job_id, job=body)
    if job is None:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Scheduler job not found")

    return job


@router.delete(
    "/schedulers/{job_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
)
async def delete(request: Request, job_id: UUID, service: SchedulerJobService = Depends(get_scheduler_job_service)):
    requester = request.state.user
    if not requester or not await user_is_super_admin(requester):
        raise HTTPException(status_code=403, detail="Access denied")

    deleted = await service.delete(job_id=job_id)
    if not deleted:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Scheduler job not found")
