import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from sqlalchemy import select

from application.templates.model import Template
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from graphql_api.helpers import IsAuthenticated, get_requested_fields, parse_range, parse_sort
from graphql_api.modules.template.converters import convert_template, template_options
from graphql_api.modules.template.types import TemplateType


@strawberry.type
class TemplateQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def template(self, info: Info, id: uuid.UUID) -> TemplateType | None:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Template).where(Template.id == id).options(*template_options(fields))
        result = await session.execute(stmt)
        obj = result.scalars().unique().first()
        if obj is None:
            return None
        return convert_template(obj, fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def templates(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[TemplateType]:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Template).options(*template_options(fields))
        stmt = evaluate_sqlalchemy_filters(
            Template, stmt, cast(dict[str, Any], cast(object, filter)) if filter else None
        )
        stmt = evaluate_sqlalchemy_sorting(Template, stmt, parse_sort(sort))
        stmt = evaluate_sqlalchemy_pagination(stmt, parse_range(range))
        result = await session.execute(stmt)
        return [x for x in (convert_template(t, fields) for t in result.scalars().unique().all()) if x is not None]
