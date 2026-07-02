import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from core.audit_logs.dependencies import get_audit_log_service
from core.audit_logs.service import AuditLogService
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    check_api_permission,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.audit_log.types import AuditLogType


def _build_service(info: Info) -> AuditLogService:
    session = info.context["session"]
    return get_audit_log_service(session=session)


@strawberry.type
class AuditLogQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def audit_log(self, info: Info, id: uuid.UUID) -> AuditLogType | None:
        await check_api_permission(info, "audit_log", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "auditLog")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def audit_logs(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[AuditLogType]:
        await check_api_permission(info, "audit_log", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "auditLogs")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def audit_logs_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        await check_api_permission(info, "audit_log", ["read"])
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def audit_log_actions(self, info: Info) -> list[str]:
        await check_api_permission(info, "audit_log", ["read"])
        service = _build_service(info)
        return await service.get_actions()
