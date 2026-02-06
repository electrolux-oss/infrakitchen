from fastapi import APIRouter, Depends, Response
from fastapi import status as http_status

from core.audit_logs.schema import AuditLogResponse
from core.audit_logs.service import AuditLogService
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from infrakitchen_mcp.dispatch_framework import get_one_group, list_entities_group
from infrakitchen_mcp.registry import mcp_group
from .dependencies import get_audit_log_service

router = APIRouter()


@router.get(
    "/audit_logs/actions",
    response_model=list[str],
    response_description="Get unique actions",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(service: AuditLogService = Depends(get_audit_log_service)):
    return await service.get_actions()


@router.get(
    "/audit_logs/{entity_id}",
    response_model=AuditLogResponse,
    response_description="Get one audit log by id",
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(get_one_group, "audit_logs", param_renames={"id": "entity_id"})
async def get_by_id(entity_id: str, service: AuditLogService = Depends(get_audit_log_service)):
    entity = await service.get_by_id(entity_id=entity_id)
    return entity


@router.get(
    "/audit_logs",
    response_model=list[AuditLogResponse],
    response_description="Get all audit logs",
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(list_entities_group, "audit_logs")
async def get_all(
    response: Response,
    service: AuditLogService = Depends(get_audit_log_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, _ = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"audit_logs 0-{len(result)}/{total}"}
    response.headers.update(headers)
    return result
