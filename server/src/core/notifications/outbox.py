import uuid
from datetime import timedelta

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.db_engine import engine
from core.pubsub import NOTIFICATION_OUTBOX_TOPIC, notify_in

from .model import FINISHED_OUTBOX_STATUSES, NotificationEvent, NotificationOutboxItem, OutboxStatus


async def enqueue_notifications(events: list[NotificationEvent]) -> None:
    """Store notification events for routing and wake up the dispatchers.

    Uses a plain ``AsyncSession``, like ``enqueue_tasks``: it runs while EventSenders
    are being flushed, and ``EventFlushingSession`` would flush them again on commit.
    """
    if not events:
        return
    async with AsyncSession(engine, expire_on_commit=False) as session:
        session.add_all([NotificationOutboxItem(payload=event.to_payload()) for event in events])
        await notify_in(session, [(NOTIFICATION_OUTBOX_TOPIC, {})])
        await session.commit()


class NotificationOutboxCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def claim(self, lease_seconds: int) -> NotificationOutboxItem | None:
        """Lease the oldest ready item, or one whose claimer died before finishing it."""
        claimable = (
            select(NotificationOutboxItem.id)
            .where(
                or_(
                    (NotificationOutboxItem.status == OutboxStatus.QUEUED)
                    & (NotificationOutboxItem.available_at <= func.now()),
                    (NotificationOutboxItem.status == OutboxStatus.RUNNING)
                    & (NotificationOutboxItem.locked_until < func.now()),
                )
            )
            .order_by(NotificationOutboxItem.seq)
            .limit(1)
            .with_for_update(skip_locked=True)
            .scalar_subquery()
        )
        statement = (
            update(NotificationOutboxItem)
            .where(NotificationOutboxItem.id == claimable)
            .values(
                status=OutboxStatus.RUNNING,
                attempts=NotificationOutboxItem.attempts + 1,
                claim_token=uuid.uuid4(),
                locked_until=func.now() + timedelta(seconds=lease_seconds),
            )
            .returning(NotificationOutboxItem)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def finish(self, item: NotificationOutboxItem, status: OutboxStatus, error: str | None = None) -> bool:
        statement = (
            update(NotificationOutboxItem)
            .where(
                NotificationOutboxItem.id == item.id,
                NotificationOutboxItem.claim_token == item.claim_token,
                NotificationOutboxItem.status == OutboxStatus.RUNNING,
            )
            .values(status=status, error=error, finished_at=func.now(), locked_until=None)
        )
        result = await self.session.execute(statement)
        return (getattr(result, "rowcount", 0) or 0) > 0

    async def retry(self, item: NotificationOutboxItem, delay_seconds: float, error: str) -> bool:
        statement = (
            update(NotificationOutboxItem)
            .where(
                NotificationOutboxItem.id == item.id,
                NotificationOutboxItem.claim_token == item.claim_token,
                NotificationOutboxItem.status == OutboxStatus.RUNNING,
            )
            .values(
                status=OutboxStatus.QUEUED,
                error=error,
                available_at=func.now() + timedelta(seconds=delay_seconds),
                locked_until=None,
            )
        )
        result = await self.session.execute(statement)
        return (getattr(result, "rowcount", 0) or 0) > 0

    async def purge_finished(self, older_than_days: int) -> int:
        statement = delete(NotificationOutboxItem).where(
            NotificationOutboxItem.status.in_(FINISHED_OUTBOX_STATUSES),
            NotificationOutboxItem.finished_at < func.now() - timedelta(days=older_than_days),
        )
        result = await self.session.execute(statement)
        return getattr(result, "rowcount", 0) or 0
