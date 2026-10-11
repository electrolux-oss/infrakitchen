import logging
import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.worker_templates.dependencies import get_worker_template_service
from application.worker_templates.service import WorkerTemplateService
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    check_api_permission,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.worker_template.types import (
    WorkerInstanceType,
    WorkerInstancesType,
    WorkerTemplateType,
)

logger = logging.getLogger(__name__)


def _build_service(info: Info) -> WorkerTemplateService:
    session = info.context["session"]
    return get_worker_template_service(session=session)


@strawberry.type
class WorkerTemplateQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def worker_template(self, info: Info, id: uuid.UUID) -> WorkerTemplateType | None:
        await check_api_permission(info, "worker_template", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "workerTemplate")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def worker_templates(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[WorkerTemplateType]:
        await check_api_permission(info, "worker_template", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "workerTemplates")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def worker_templates_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        await check_api_permission(info, "worker_template", ["read"])
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def worker_template_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        await check_api_permission(info, "worker_template", ["read"])
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(worker_template_id=id, requester=requester)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def worker_providers(self, info: Info) -> list[str]:
        await check_api_permission(info, "worker_template", ["read"])
        return WorkerTemplateService.list_providers()

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def worker_template_default_configuration(self, info: Info, provider: str) -> JSON:
        await check_api_permission(info, "worker_template", ["read"])
        return cast(JSON, cast(object, WorkerTemplateService.get_default_configuration(provider)))

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def worker_template_instances(self, info: Info, id: uuid.UUID) -> WorkerInstancesType:
        await check_api_permission(info, "worker_template", ["read"])
        service = _build_service(info)
        try:
            instances = await service.list_instances(id)
        except Exception as e:
            logger.warning(f"Cannot list workers of template {id}: {e}")
            return WorkerInstancesType(instances=[], error=str(e))
        return WorkerInstancesType(instances=[WorkerInstanceType.from_instance(i) for i in instances])
