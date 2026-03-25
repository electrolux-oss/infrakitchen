import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from sqlalchemy import select

from application.source_code_versions.model import SourceCodeVersion
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from graphql_api.helpers import get_requested_fields, parse_range, parse_sort
from graphql_api.modules.source_code_version.converters import convert_source_code_version, source_code_version_options
from graphql_api.modules.source_code_version.types import SourceCodeVersionType


@strawberry.type
class SourceCodeVersionQuery:
    @strawberry.field
    async def source_code_version(self, info: Info, id: uuid.UUID) -> SourceCodeVersionType | None:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(SourceCodeVersion).where(SourceCodeVersion.id == id).options(*source_code_version_options(fields))
        result = await session.execute(stmt)
        obj = result.scalars().unique().first()
        if obj is None:
            return None
        return convert_source_code_version(obj, fields)

    @strawberry.field
    async def source_code_versions(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[SourceCodeVersionType]:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(SourceCodeVersion).options(*source_code_version_options(fields))
        stmt = evaluate_sqlalchemy_filters(
            SourceCodeVersion, stmt, cast(dict[str, Any], cast(object, filter)) if filter else None
        )
        stmt = evaluate_sqlalchemy_sorting(SourceCodeVersion, stmt, parse_sort(sort))
        stmt = evaluate_sqlalchemy_pagination(stmt, parse_range(range))
        result = await session.execute(stmt)
        return [
            x
            for x in (convert_source_code_version(s, fields) for s in result.scalars().unique().all())
            if x is not None
        ]
