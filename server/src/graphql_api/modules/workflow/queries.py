import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.workflows.dependencies import get_workflow_service
from application.workflows.service import WorkflowService
from graphql_api.helpers import IsAuthenticated, build_field_spec, get_entity_selection, parse_range, parse_sort
from graphql_api.modules.workflow.types import WorkflowType


def _build_service(info: Info) -> WorkflowService:
    session = info.context["session"]
    return get_workflow_service(session=session)


@strawberry.type
class WorkflowQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def workflow(self, info: Info, id: uuid.UUID) -> WorkflowType | None:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "workflow")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def workflows(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[WorkflowType]:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "workflows")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def workflows_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def workflow_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(workflow_id=id, requester=requester)
