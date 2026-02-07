from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from .model import AuditLog


class AuditLogHandler:
    def __init__(self, session: AsyncSession, entity_name: str):
        self.session: AsyncSession = session
        self.entity_name: str = entity_name
        self.trace_id: str | None = None

    async def create_log(self, entity_id: str | UUID, requester_id: str | UUID, action: str) -> None:
        audit_log = AuditLog(
            model=str(self.entity_name),
            user_id=requester_id,
            action=action,
            entity_id=entity_id,
        )
        self.session.add(audit_log)
        await self.session.flush()
        # Store audit log ID as trace_id for using in other operations
        self.trace_id = str(audit_log.id)
