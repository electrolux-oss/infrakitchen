import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from sqlalchemy import select

from application.source_codes.model import SourceCode
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from graphql_api.helpers import IsAuthenticated, get_requested_fields, parse_range, parse_sort
from graphql_api.modules.source_code.converters import convert_source_code, source_code_options
from graphql_api.modules.source_code.types import SourceCodeType


@strawberry.type
class SourceCodeQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code(self, info: Info, id: uuid.UUID) -> SourceCodeType | None:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(SourceCode).where(SourceCode.id == id).options(*source_code_options(fields))
        result = await session.execute(stmt)
        obj = result.scalars().first()
        if obj is None:
            return None
        return convert_source_code(obj, fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_codes(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[SourceCodeType]:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(SourceCode).options(*source_code_options(fields))
        stmt = evaluate_sqlalchemy_filters(
            SourceCode, stmt, cast(dict[str, Any], cast(object, filter)) if filter else None
        )
        stmt = evaluate_sqlalchemy_sorting(SourceCode, stmt, parse_sort(sort))
        stmt = evaluate_sqlalchemy_pagination(stmt, parse_range(range))
        result = await session.execute(stmt)
        return [x for x in (convert_source_code(s, fields) for s in result.scalars().all()) if x is not None]
