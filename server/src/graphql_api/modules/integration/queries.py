import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from sqlalchemy import select

from application.integrations.model import Integration
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from graphql_api.helpers import IsAuthenticated, get_requested_fields, parse_range, parse_sort
from graphql_api.modules.integration.converters import convert_integration, integration_options
from graphql_api.modules.integration.types import IntegrationType


@strawberry.type
class IntegrationQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def integration(self, info: Info, id: uuid.UUID) -> IntegrationType | None:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Integration).where(Integration.id == id).options(*integration_options(fields))
        result = await session.execute(stmt)
        obj = result.scalars().first()
        if obj is None:
            return None
        return convert_integration(obj, fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def integrations(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[IntegrationType]:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Integration).options(*integration_options(fields))
        stmt = evaluate_sqlalchemy_filters(
            Integration, stmt, cast(dict[str, Any], cast(object, filter)) if filter else None
        )
        stmt = evaluate_sqlalchemy_sorting(Integration, stmt, parse_sort(sort))
        stmt = evaluate_sqlalchemy_pagination(stmt, parse_range(range))
        result = await session.execute(stmt)
        return [x for x in (convert_integration(i, fields) for i in result.scalars().all()) if x is not None]
