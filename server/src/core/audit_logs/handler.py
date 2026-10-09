from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


from .model import AuditLog


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

    async def get_last_actor_id(self, entity_id: str | UUID, actions: list[str]) -> UUID | None:
        """ID of the user who most recently performed one of the actions on the entity."""
        statement = (
            select(AuditLog.user_id)
            .where(
                AuditLog.model == self.entity_name,
                AuditLog.entity_id == entity_id,
                AuditLog.action.in_(actions),
            )
            .order_by(AuditLog.created_at.desc())
            .limit(1)
        )
        user_id = (await self.session.execute(statement)).scalar_one_or_none()
        return UUID(str(user_id)) if user_id is not None else None
