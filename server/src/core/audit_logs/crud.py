from typing import Any
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import (
    FieldSpec,
    evaluate_sqlalchemy_filters,
    evaluate_sqlalchemy_pagination,
    evaluate_sqlalchemy_sorting,
)
from core.utils.model_tools import is_valid_uuid

from .functions import DENIED_OUTCOME
from .model import AuditLog
from .query_options import build_audit_log_query_options


EXCLUDE_DENIED_FILTER = "exclude_denied"


def _apply_filters(statement: Select[Any], filter: dict[str, Any] | None) -> Select[Any]:
    """Apply generic filters plus the audit-specific ``exclude_denied`` flag.

    ``exclude_denied: true`` hides permission-denial rows (``metadata.denied == "true"``).
    """
    if filter is None:
        return statement
    filter = dict(filter)
    exclude_denied = filter.pop(EXCLUDE_DENIED_FILTER, False)
    statement = evaluate_sqlalchemy_filters(AuditLog, statement, filter)
    if exclude_denied is True:
        denied = AuditLog.action_metadata[DENIED_OUTCOME].as_string()
        statement = statement.where(func.coalesce(denied, "") != "true")
    return statement


class AuditLogCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(
        self,
        entity_id: str | UUID,
        fields: FieldSpec | None = None,
    ) -> AuditLog | None:
        if not is_valid_uuid(entity_id):
            raise ValueError(f"Invalid UUID: {entity_id}")

        statement = select(AuditLog).where(AuditLog.id == entity_id)
        statement = statement.options(*build_audit_log_query_options(fields))
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[AuditLog]:
        statement = select(AuditLog)
        statement = _apply_filters(statement, filter)
        statement = evaluate_sqlalchemy_sorting(AuditLog, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        statement = statement.options(*build_audit_log_query_options(fields))
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(AuditLog)
        statement = _apply_filters(statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def get_actions(self) -> list[str]:
        stmt = select(AuditLog.action).distinct().order_by(AuditLog.action)
        result = await self.session.execute(stmt)
        return [row[0] for row in result.all() if row[0] is not None]
