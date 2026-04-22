import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from sqlalchemy import select

from application.blueprints.model import Blueprint
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from graphql_api.helpers import IsAuthenticated, get_nested_fields, get_requested_fields, parse_range, parse_sort
from graphql_api.modules.blueprint.converters import blueprint_options, convert_blueprint
from graphql_api.modules.blueprint.types import BlueprintType


@strawberry.type
class BlueprintQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def blueprint(self, info: Info, id: uuid.UUID) -> BlueprintType | None:
        session = info.context["session"]
        fields = get_requested_fields(info)
        workflow_fields = get_nested_fields(info, "workflows")
        step_fields = get_nested_fields(info, "workflows", "steps")
        stmt = (
            select(Blueprint)
            .where(Blueprint.id == id)
            .options(*blueprint_options(fields, workflow_fields, step_fields))
        )
        result = await session.execute(stmt)
        obj = result.scalars().unique().first()
        if obj is None:
            return None
        return convert_blueprint(obj, fields, workflow_fields, step_fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def blueprints(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[BlueprintType]:
        session = info.context["session"]
        fields = get_requested_fields(info)
        workflow_fields = get_nested_fields(info, "workflows")
        step_fields = get_nested_fields(info, "workflows", "steps")
        stmt = select(Blueprint).options(*blueprint_options(fields, workflow_fields, step_fields))
        stmt = evaluate_sqlalchemy_filters(
            Blueprint, stmt, cast(dict[str, Any], cast(object, filter)) if filter else None
        )
        stmt = evaluate_sqlalchemy_sorting(Blueprint, stmt, parse_sort(sort))
        stmt = evaluate_sqlalchemy_pagination(stmt, parse_range(range))
        result = await session.execute(stmt)
        return [
            x
            for x in (
                convert_blueprint(b, fields, workflow_fields, step_fields) for b in result.scalars().unique().all()
            )
            if x is not None
        ]
