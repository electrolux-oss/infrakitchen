import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from sqlalchemy import select

from application.executors.model import Executor
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from graphql_api.helpers import IsAuthenticated, get_requested_fields, parse_range, parse_sort
from graphql_api.modules.executor.converters import convert_executor, executor_options
from graphql_api.modules.executor.types import ExecutorType


@strawberry.type
class ExecutorQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def executor(self, info: Info, id: uuid.UUID) -> ExecutorType | None:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Executor).where(Executor.id == id).options(*executor_options(fields))
        result = await session.execute(stmt)
        obj = result.scalars().unique().first()
        if obj is None:
            return None
        return convert_executor(obj, fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def executors(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[ExecutorType]:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Executor).options(*executor_options(fields))
        stmt = evaluate_sqlalchemy_filters(
            Executor, stmt, cast(dict[str, Any], cast(object, filter)) if filter else None
        )
        stmt = evaluate_sqlalchemy_sorting(Executor, stmt, parse_sort(sort))
        stmt = evaluate_sqlalchemy_pagination(stmt, parse_range(range))
        result = await session.execute(stmt)
        return [convert_executor(e, fields) for e in result.scalars().unique().all()]
