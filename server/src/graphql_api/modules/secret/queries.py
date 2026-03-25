import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from sqlalchemy import select

from application.secrets.model import Secret
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from graphql_api.helpers import get_requested_fields, parse_range, parse_sort
from graphql_api.modules.secret.converters import convert_secret, secret_options
from graphql_api.modules.secret.types import SecretType


@strawberry.type
class SecretQuery:
    @strawberry.field
    async def secret(self, info: Info, id: uuid.UUID) -> SecretType | None:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Secret).where(Secret.id == id).options(*secret_options(fields))
        result = await session.execute(stmt)
        obj = result.scalars().first()
        if obj is None:
            return None
        return convert_secret(obj, fields)

    @strawberry.field
    async def secrets(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[SecretType]:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Secret).options(*secret_options(fields))
        stmt = evaluate_sqlalchemy_filters(Secret, stmt, cast(dict[str, Any], cast(object, filter)) if filter else None)
        stmt = evaluate_sqlalchemy_sorting(Secret, stmt, parse_sort(sort))
        stmt = evaluate_sqlalchemy_pagination(stmt, parse_range(range))
        result = await session.execute(stmt)
        return [x for x in (convert_secret(s, fields) for s in result.scalars().all()) if x is not None]
