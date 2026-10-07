import asyncio
import logging
from typing import Any, cast
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration
from application.resources.dependencies import get_resource_service
import core.pubsub as pubsub
from core.config import Settings
from core.database import FieldSpec
from core.dependencies import get_async_session

from application.providers import NotificationProviderAdapter
from application.integrations.dependencies import get_integration_service
from core.notifications.dependencies import get_notification_preference_service, get_subscription_service
from core.notifications.model import NotificationChannel, NotificationEvent, NotificationOutboxItem, OutboxStatus
from core.notifications.outbox import NotificationOutboxCRUD

logger = logging.getLogger(__name__)


async def _get_provider_integration(provider: str) -> Integration | None:
    """Resolve the integration configuration for an external notification provider."""

    async with get_async_session() as session:
        service = get_integration_service(session=session)
        integrations = await service.query_all(
            filter={"integration_provider": provider}, fields={"configuration": None}
        )
        if not integrations:
            return None

        if len(integrations) > 1:
            logger.warning(f"Multiple integrations found for provider '{provider}', using the first one")
        return integrations[0]


async def _dispatch_notification(msg: dict[str, Any]) -> None:
    """Dispatch a single notification message to the appropriate provider adapter."""

    provider = msg.get("provider")
    user_id = msg.get("user_id")

    if not provider or not user_id:
        logger.warning(f"Message missing provider or user_id: {msg}")
        return

    if provider == "in_app":
        await pubsub.publish(pubsub.in_app_notifications_topic(user_id), msg)
        return

    adapter_cls: type[NotificationProviderAdapter] | None = NotificationProviderAdapter.notification_adapters.get(
        provider
    )
    if not adapter_cls:
        logger.warning(f"No notification provider adapter registered for: {provider}")
        return

    integration = await _get_provider_integration(provider)
    if not integration or not integration.configuration:
        logger.error(f"No integration found for provider '{provider}', cannot send notification")
        return

    adapter_instance = cast(Any, adapter_cls)(configuration=integration.configuration)
    await adapter_instance.authenticate()
    await adapter_instance.send_notification(**msg)


async def _route_notification_event(event: NotificationEvent, session: AsyncSession) -> None:
    """Resolve subscriptions and preferences for an event and dispatch per-user-per-channel messages.

    - IN_APP: publishes to the user's ``notifications.in_app.<user_id>`` pubsub topic.
    - External providers (e.g. Slack): dispatches directly via the registered adapter.
    """
    subscription_service = get_subscription_service(session)
    preference_service = get_notification_preference_service(session=session)
    resource_service = get_resource_service(session=session)

    # project subscriptions
    project_specific = []
    if event.entity_type == "resource" and event.entity_id is not None:
        resource = await resource_service.get_by_id(event.entity_id)
        if not resource:
            logger.warning(f"Resource with ID {event.entity_id} not found, cannot route notification")
            return

        if resource.project_id:
            project_specific = await subscription_service.query_all(
                filter={"entity_type": "project", "entity_id": resource.project_id},
            )

    sub_fields: FieldSpec = {
        "entity_type": None,
        "entity_id": None,
        "user": cast(FieldSpec, {"id": None, "meta": None, "deactivated": None}),
    }
    specific = await subscription_service.query_all(
        filter={"entity_type": event.entity_type, "entity_id": event.entity_id}, fields=sub_fields
    )
    wildcard = await subscription_service.query_all(
        filter={"entity_type": event.entity_type, "entity_id": None}, fields=sub_fields
    )

    seen_user_ids: set[str] = set()
    subscriptions = []
    for sub in specific + wildcard + project_specific:
        uid = str(sub.user_id)
        if uid not in seen_user_ids:
            seen_user_ids.add(uid)
            if sub.user.deactivated:
                logger.debug(f"Skipping deactivated user {uid} for subscription {sub.id}")
                continue
            subscriptions.append(sub)

    if not subscriptions:
        logger.debug(f"No subscriptions found for {event.entity_type}:{event.entity_id}")
        return

    user_ids: set[UUID] = {sub.user_id for sub in subscriptions if sub.user_id is not None}

    pref_fields: FieldSpec = {
        "user": cast(FieldSpec, {"id": None, "meta": None}),
        "channels": None,
    }
    all_preferences = await preference_service.query_all(
        filter={"user_id__in": list(user_ids), "event_type": event.event_type},
        fields=pref_fields,
    )

    for preference in all_preferences:
        user_id = preference.user_id
        for channel in [NotificationChannel(c) for c in preference.channels]:
            body: dict[str, Any] = {
                "msg": event.message,
                "title": event.title,
                "status": event.status,
                "entity_id": str(event.entity_id) if event.entity_id is not None else None,
                "entity_name": event.entity_type,
                "provider": channel.value.lower(),
                "user_id": str(user_id),
            }

            if channel == NotificationChannel.SLACK:
                user_meta = preference.user.meta
                slack_id = (
                    user_meta.get("slack_id") if isinstance(user_meta, dict) else getattr(user_meta, "slack_id", None)
                )
                if not slack_id:
                    logger.debug(f"User {user_id} prefers Slack but has no slack_id, skipping")
                    continue
                body["channel"] = slack_id

            try:
                await _dispatch_notification(body)
                logger.info(f"Notification dispatched to user {user_id} via {channel.value}")
            except Exception as e:
                logger.error(f"Failed to notify user {user_id} via {channel.value}: {e}", exc_info=True)


class NotificationDispatcher:
    """Routes notification outbox items to subscribers, a few at a time.

    Runs in every API process. Items are claimed with ``FOR UPDATE SKIP LOCKED``,
    so each event is routed once across replicas; a failed routing is retried with
    backoff, and an item whose claimer died is picked up again once its lease expires.
    """

    def __init__(
        self,
        concurrency: int | None = None,
        lease_seconds: int | None = None,
        poll_interval: float = 10.0,
    ):
        settings = Settings()
        self.concurrency: int = concurrency or settings.NOTIFICATION_DISPATCHERS
        self.lease_seconds: int = lease_seconds or settings.NOTIFICATION_LEASE_SECONDS
        self.poll_interval: float = poll_interval
        self._wakeup: asyncio.Event = asyncio.Event()

    @staticmethod
    def retry_delay(attempts: int) -> float:
        """Back off 5s, 10s, 20s, ... between attempts."""
        return 5.0 * (2 ** max(attempts - 1, 0))

    async def run(self) -> None:
        loops = [asyncio.create_task(self._dispatch_loop()) for _ in range(self.concurrency)]
        try:
            async with pubsub.hub.subscribe(pubsub.NOTIFICATION_OUTBOX_TOPIC) as wakeups:
                logger.info(f"Notification dispatcher started with {self.concurrency} concurrent routers")
                async for _ in wakeups:
                    self._wakeup.set()
        finally:
            for loop in loops:
                _ = loop.cancel()
            _ = await asyncio.gather(*loops, return_exceptions=True)

    async def _dispatch_loop(self) -> None:
        while True:
            # Cleared before claiming, so a wakeup that arrives meanwhile isn't lost
            self._wakeup.clear()
            try:
                did_work = await self.dispatch_once()
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"Notification dispatcher error: {e}", exc_info=True)
                did_work = False
            if not did_work:
                try:
                    _ = await asyncio.wait_for(self._wakeup.wait(), timeout=self.poll_interval)
                except TimeoutError:
                    pass

    async def dispatch_once(self) -> bool:
        """Claim and route one outbox item. Returns True if there was one."""
        async with get_async_session() as session:
            item = await NotificationOutboxCRUD(session).claim(self.lease_seconds)
            await session.commit()
        if item is None:
            return False

        if item.attempts > item.max_attempts:
            # Its claimers kept dying before they could record a result
            await self._finish(item, OutboxStatus.FAILED, "Gave up after the dispatcher was lost too many times")
            return True

        try:
            event = NotificationEvent(**item.payload)
            async with get_async_session() as session:
                await _route_notification_event(event, session)
        except Exception as e:
            error = f"{type(e).__name__}: {e}"
            if item.attempts >= item.max_attempts:
                logger.error(f"Giving up on notification {item.id} after {item.attempts} attempts: {error}")
                await self._finish(item, OutboxStatus.FAILED, error)
            else:
                logger.warning(f"Failed to route notification {item.id} (attempt {item.attempts}): {error}")
                async with get_async_session() as session:
                    _ = await NotificationOutboxCRUD(session).retry(item, self.retry_delay(item.attempts), error)
                    await session.commit()
            return True

        await self._finish(item, OutboxStatus.DONE)
        return True

    async def _finish(self, item: NotificationOutboxItem, status: OutboxStatus, error: str | None = None) -> None:
        async with get_async_session() as session:
            _ = await NotificationOutboxCRUD(session).finish(item, status, error)
            await session.commit()


async def start_notification_dispatcher() -> None:
    """Run the notification dispatcher, restarting it if it stops unexpectedly."""
    while True:
        try:
            await NotificationDispatcher().run()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Notification dispatcher stopped unexpectedly: {e}, restarting in 5 seconds")
            await asyncio.sleep(5)
