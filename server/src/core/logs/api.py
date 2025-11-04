from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi import status as http_status

from core.logs.schema import LogResponse
from core.logs.service import LogService
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .dependencies import get_log_service

router = APIRouter()


@router.get(
    "/logs/{entity_id}",
    response_model=LogResponse,
    response_description="Get one log by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(entity_id: str, service: LogService = Depends(get_log_service)):
    entity = await service.get_by_id(entity_id=entity_id)
    if entity is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Log with id {entity_id} not found",
        )
    return entity


@router.get(
    "/logs",
    response_model=list[LogResponse],
    response_description="Get all logs",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: LogService = Depends(get_log_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, _ = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))

    headers = {"Content-Range": f"logs 0-{len(result)}/{total}"}
    response.headers.update(headers)
    return result


@router.get(
    "/logs/execution_time/{entity_id}",
    response_description="Logs execution time",
    response_model=list[LogResponse],
)
async def get_logs_execution_time(
    entity_id: str,
    service: LogService = Depends(get_log_service),
    trace_id: str = Query(default=None, description="Trace ID for filtering logs"),
):
    """
    Execution time logs for a specific entity.
    """
    result = await service.get_logs_execution_time(entity_id=entity_id, trace_id=trace_id)
    return result
