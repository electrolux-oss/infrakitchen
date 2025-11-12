from typing import Any
from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.users.model import User
from core.database import evaluate_sqlalchemy_filters
from core.utils.model_tools import is_valid_uuid

from .model import AuditLog


class AuditLogCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, entity_id: str | UUID) -> AuditLog | None:
        if not is_valid_uuid(entity_id):
            raise ValueError(f"Invalid UUID: {entity_id}")

        statement = select(AuditLog).where(AuditLog.id == entity_id).join(User, AuditLog.user_id == User.id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[AuditLog]:
        query = filter or {}
        filters = evaluate_sqlalchemy_filters(AuditLog, query)
        statement = select(AuditLog)
        if filters:
            statement = statement.where(*filters)

        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(AuditLog, field):
                sort_column = getattr(AuditLog, field)
                statement = statement.order_by(asc(sort_column) if direction.upper() == "ASC" else desc(sort_column))

        # Apply pagination
        if range:
            skip, end = range
            limit = end - skip
            statement = statement.offset(skip).limit(limit)
        else:
            statement = statement.limit(100)  # default limit

        statement = statement.join(User, AuditLog.user_id == User.id)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(AuditLog)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(AuditLog, query)
        if filters:
            statement = statement.where(*filters)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def get_actions(self) -> list[str]:
        stmt = select(AuditLog.action).distinct().order_by(AuditLog.action)
        result = await self.session.execute(stmt)
        return [row[0] for row in result.all() if row[0] is not None]
