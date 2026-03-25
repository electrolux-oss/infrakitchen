import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from sqlalchemy import select

from application.resources.model import Resource
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from graphql_api.helpers import get_requested_fields, parse_range, parse_sort
from graphql_api.modules.resource.converters import convert_resource, resource_options
from graphql_api.modules.resource.types import ResourceType


@strawberry.type
class ResourceQuery:
    @strawberry.field
    async def resource(self, info: Info, id: uuid.UUID) -> ResourceType | None:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Resource).where(Resource.id == id).options(*resource_options(fields))
        result = await session.execute(stmt)
        obj = result.scalars().unique().first()
        if obj is None:
            return None
        return convert_resource(obj, fields)

    @strawberry.field
    async def resources(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[ResourceType]:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Resource).options(*resource_options(fields))
        stmt = evaluate_sqlalchemy_filters(
            Resource, stmt, cast(dict[str, Any], cast(object, filter)) if filter else None
        )
        stmt = evaluate_sqlalchemy_sorting(Resource, stmt, parse_sort(sort))
        stmt = evaluate_sqlalchemy_pagination(stmt, parse_range(range))
        result = await session.execute(stmt)
        return [convert_resource(r, fields) for r in result.scalars().unique().all()]
