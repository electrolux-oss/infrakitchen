from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession


from .model import AuditLog


class AuditLogHandler:
    def __init__(self, session: AsyncSession, entity_name: str):
        self.session: AsyncSession = session
        self.entity_name: str = entity_name
        self.trace_id: str | None = None
        self.audit_log_id: UUID | None = None

    async def create_log(
        self, entity_id: str | UUID, requester_id: str | UUID, action: str, revision_number: int | None = None
    ) -> None:
        audit_log = AuditLog(
            model=str(self.entity_name),
            user_id=requester_id,
            action=action,
            entity_id=entity_id,
            revision_number=revision_number,
        )
        self.session.add(audit_log)
        await self.session.flush()
        # by default we can use audit log id as trace id for better tracking of logs and audit logs in the system,
        # but it can be overridden by passing trace_id in the header of the request
        self.trace_id = str(audit_log.id)
        self.audit_log_id = audit_log.id
