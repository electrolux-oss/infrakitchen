from fastapi import APIRouter, Depends, Response
from fastapi import status as http_status

from .schema import WorkerResponse
from .service import WorkerService
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .dependencies import get_worker_service

router = APIRouter()


@router.get(
    "/workers/{entity_id}",
    response_model=WorkerResponse,
    response_description="Get one auditlog by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(entity_id: str, service: WorkerService = Depends(get_worker_service)):
    entity = await service.get_by_id(entity_id=entity_id)
    return entity


@router.get(
    "/workers",
    response_model=list[WorkerResponse],
    response_description="Get all auditlogs",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: WorkerService = Depends(get_worker_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, _ = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"workers 0-{len(result)}/{total}"}
    response.headers.update(headers)
    return result
