import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from sqlalchemy import select

from application.storages.model import Storage
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from graphql_api.helpers import IsAuthenticated, get_requested_fields, parse_range, parse_sort
from graphql_api.modules.storage.converters import convert_storage, storage_options
from graphql_api.modules.storage.types import StorageType


@strawberry.type
class StorageQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def storage(self, info: Info, id: uuid.UUID) -> StorageType | None:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Storage).where(Storage.id == id).options(*storage_options(fields))
        result = await session.execute(stmt)
        obj = result.scalars().first()
        if obj is None:
            return None
        return convert_storage(obj, fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def storages(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[StorageType]:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Storage).options(*storage_options(fields))
        stmt = evaluate_sqlalchemy_filters(
            Storage, stmt, cast(dict[str, Any], cast(object, filter)) if filter else None
        )
        stmt = evaluate_sqlalchemy_sorting(Storage, stmt, parse_sort(sort))
        stmt = evaluate_sqlalchemy_pagination(stmt, parse_range(range))
        result = await session.execute(stmt)
        return [x for x in (convert_storage(s, fields) for s in result.scalars().all()) if x is not None]
