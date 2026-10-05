from typing import Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_async_session

from .model import AuditLog


async def set_audit_log_execution(audit_log_id: str | UUID, execution: dict[str, Any]) -> None:
    """
    Store the result of the task triggered by the audit log action in its metadata under "execution".
    A separate session is used, the task session can be in a failed state.
    """
    async with get_async_session() as session:
        audit_log = await session.get(AuditLog, audit_log_id)
        if audit_log is None:
            return
        # reassign the dict, in-place changes of a JSON column are not tracked
        audit_log.action_metadata = {**(audit_log.action_metadata or {}), "execution": execution}
        await session.commit()


class AuditLogHandler:
    def __init__(self, session: AsyncSession, entity_name: str):
        self.session: AsyncSession = session
        self.entity_name: str = entity_name
        self.trace_id: str | None = None
        self.audit_log_id: UUID | None = None

    async def create_log(
        self,
        entity_id: str | UUID,
        requester_id: str | UUID,
        action: str,
        revision_number: int | None = None,
        action_metadata: dict[str, Any] | None = None,
    ) -> None:
        audit_log = AuditLog(
            model=self.entity_name,
            user_id=requester_id,
            action=action,
            entity_id=entity_id,
            revision_number=revision_number,
            action_metadata=action_metadata,
        )
        self.session.add(audit_log)
        await self.session.flush()
        self.audit_log_id = audit_log.id
