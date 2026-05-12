import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from sqlalchemy import func, select

from application.workflows.model import Workflow
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from graphql_api.helpers import IsAuthenticated, get_nested_fields, get_requested_fields, parse_range, parse_sort
from graphql_api.modules.workflow.converters import convert_workflow, workflow_options
from graphql_api.modules.workflow.types import WorkflowType


@strawberry.type
class WorkflowQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def workflow(self, info: Info, id: uuid.UUID) -> WorkflowType | None:
        session = info.context["session"]
        fields = get_requested_fields(info)
        step_fields = get_nested_fields(info, "steps")
        stmt = select(Workflow).where(Workflow.id == id).options(*workflow_options(fields, step_fields))
        result = await session.execute(stmt)
        obj = result.scalars().unique().first()
        if obj is None:
            return None
        return convert_workflow(obj, fields, step_fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def workflows(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[WorkflowType]:
        session = info.context["session"]
        fields = get_requested_fields(info)
        step_fields = get_nested_fields(info, "steps")
        stmt = select(Workflow).options(*workflow_options(fields, step_fields))
        stmt = evaluate_sqlalchemy_filters(
            Workflow, stmt, cast(dict[str, Any], cast(object, filter)) if filter else None
        )
        stmt = evaluate_sqlalchemy_sorting(Workflow, stmt, parse_sort(sort))
        stmt = evaluate_sqlalchemy_pagination(stmt, parse_range(range))
        result = await session.execute(stmt)
        return [
            x
            for x in (convert_workflow(w, fields, step_fields) for w in result.scalars().unique().all())
            if x is not None
        ]

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def workflows_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        session = info.context["session"]
        stmt = select(func.count()).select_from(Workflow)
        stmt = evaluate_sqlalchemy_filters(
            Workflow, stmt, cast(dict[str, Any], cast(object, filter)) if filter else None
        )
        result = await session.execute(stmt)
        return result.scalar_one()
