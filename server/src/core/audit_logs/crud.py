from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.revisions.model import Revision
from core.users.model import User
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.utils.model_tools import is_valid_uuid

from .model import AuditLog


def _revision_subquery():
    return (
        select(Revision.revision_number)
        .where(Revision.entity_id == AuditLog.entity_id)
        .where(Revision.created_at <= AuditLog.created_at)
        .order_by(Revision.created_at.desc())
        .limit(1)
        .correlate(AuditLog)
        .scalar_subquery()
        .label("revision_number")
    )


class AuditLogCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, entity_id: str | UUID) -> AuditLog | None:
        if not is_valid_uuid(entity_id):
            raise ValueError(f"Invalid UUID: {entity_id}")

        revision_subq = _revision_subquery()
        statement = (
            select(AuditLog, revision_subq).where(AuditLog.id == entity_id).join(User, AuditLog.user_id == User.id)
        )
        result = await self.session.execute(statement)
        row = result.one_or_none()
        if row is None:
            return None
        audit_log, revision_number = row
        audit_log.revision_number = revision_number
        return audit_log

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[AuditLog]:
        revision_subq = _revision_subquery()
        statement = select(AuditLog, revision_subq)
        statement = evaluate_sqlalchemy_filters(AuditLog, statement, filter)
        statement = evaluate_sqlalchemy_sorting(AuditLog, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        statement = statement.join(User, AuditLog.user_id == User.id)
        result = await self.session.execute(statement)
        rows = result.all()
        result_list = []
        for row in rows:
            audit_log, revision_number = row
            audit_log.revision_number = revision_number
            result_list.append(audit_log)
        return result_list

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(AuditLog)
        statement = evaluate_sqlalchemy_filters(AuditLog, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def get_actions(self) -> list[str]:
        stmt = select(AuditLog.action).distinct().order_by(AuditLog.action)
        result = await self.session.execute(stmt)
        return [row[0] for row in result.all() if row[0] is not None]
