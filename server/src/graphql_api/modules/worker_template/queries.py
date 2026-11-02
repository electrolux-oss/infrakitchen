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
    WorkerInstanceLogsType,
    WorkerInstanceManifestType,
    WorkerInstanceType,
    WorkerInstancesType,
    WorkerTemplateShortType,
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
    async def worker_template_options(self, info: Info) -> list[WorkerTemplateShortType]:
        """Templates that resources and executors can select, for users without access to worker templates."""
        service = _build_service(info)
        templates = await service.query_all(
            sort=("name", "ASC"),
            fields={"id": None, "name": None, "status": None, "is_default": None},
        )
        return [
            WorkerTemplateShortType(id=t.id, name=t.name, status=str(t.status), is_default=t.is_default)
            for t in templates
        ]

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
        workers = await service.workers_by_host([i.host for i in instances])
        return WorkerInstancesType(
            instances=[WorkerInstanceType.from_instance(i, workers.get(i.host)) for i in instances]
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def worker_instance_logs(
        self, info: Info, id: uuid.UUID, instance_id: str, tail: int = 500
    ) -> WorkerInstanceLogsType:
        await check_api_permission(info, "worker_template", ["read"])
        service = _build_service(info)
        try:
            logs = await service.get_instance_logs(id, instance_id, tail=tail)
        except Exception as e:
            logger.warning(f"Cannot read logs of worker {instance_id} of template {id}: {e}")
            return WorkerInstanceLogsType(logs="", error=str(e))
        return WorkerInstanceLogsType(logs=logs)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def worker_instance_manifest(self, info: Info, id: uuid.UUID, instance_id: str) -> WorkerInstanceManifestType:
        await check_api_permission(info, "worker_template", ["read"])
        service = _build_service(info)
        try:
            manifest = await service.get_instance_manifest(id, instance_id)
        except Exception as e:
            logger.warning(f"Cannot read manifest of worker {instance_id} of template {id}: {e}")
            return WorkerInstanceManifestType(error=str(e))
        return WorkerInstanceManifestType(manifest=cast(JSON, cast(object, manifest)))
