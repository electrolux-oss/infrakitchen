import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from sqlalchemy import select

from application.workspaces.model import Workspace
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from graphql_api.helpers import get_requested_fields, parse_range, parse_sort
from graphql_api.modules.workspace.converters import convert_workspace, workspace_options
from graphql_api.modules.workspace.types import WorkspaceType


@strawberry.type
class WorkspaceQuery:
    @strawberry.field
    async def workspace(self, info: Info, id: uuid.UUID) -> WorkspaceType | None:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Workspace).where(Workspace.id == id).options(*workspace_options(fields))
        result = await session.execute(stmt)
        obj = result.scalars().first()
        if obj is None:
            return None
        return convert_workspace(obj, fields)

    @strawberry.field
    async def workspaces(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[WorkspaceType]:
        session = info.context["session"]
        fields = get_requested_fields(info)
        stmt = select(Workspace).options(*workspace_options(fields))
        stmt = evaluate_sqlalchemy_filters(
            Workspace, stmt, cast(dict[str, Any], cast(object, filter)) if filter else None
        )
        stmt = evaluate_sqlalchemy_sorting(Workspace, stmt, parse_sort(sort))
        stmt = evaluate_sqlalchemy_pagination(stmt, parse_range(range))
        result = await session.execute(stmt)
        return [x for x in (convert_workspace(w, fields) for w in result.scalars().all()) if x is not None]
