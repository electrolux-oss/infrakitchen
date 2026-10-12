import asyncio
import logging
from collections.abc import Iterable
from typing import Any, cast
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration
from application.resources.dependencies import get_resource_service
from application.resources.functions import get_resource_approver_ids
from application.resources.schema import ResourceResponse
import core.pubsub as pubsub
from core.config import Settings
from core.constants.model import EventType
from core.database import FieldSpec
from core.dependencies import get_async_session

from application.providers import NotificationProviderAdapter
from application.integrations.dependencies import get_integration_service
from core.notifications.dependencies import get_notification_preference_service, get_subscription_service
from core.notifications.in_app import deliver_in_app_notifications
from core.notifications.model import NotificationChannel, NotificationEvent, NotificationOutboxItem, OutboxStatus
from core.notifications.outbox import NotificationOutboxCRUD
from core.users.accounts import resolve_primary_ids
from core.users.dependencies import get_user_service
from core.users.functions import get_super_admin_user_ids
from core.utils.model_tools import is_valid_uuid

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
    """Send a single notification message through an external provider adapter (e.g. Slack)."""

    provider = msg.get("provider")
    user_id = msg.get("user_id")

    if not provider or not user_id:
        logger.warning(f"Message missing provider or user_id: {msg}")
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


def _build_message(
    event: NotificationEvent, user_id: UUID | str | None, channel: NotificationChannel, entity_name: str | None
) -> dict[str, Any]:
    return {
        "msg": event.message,
        "title": event.title,
        "status": event.status,
        "event_type": str(event.event_type),
        "entity_type": event.entity_type,
        "entity_id": str(event.entity_id) if event.entity_id is not None else None,
        "entity_name": entity_name,
        "provider": channel.value.lower(),
        "user_id": str(user_id),
    }


def _get_provider_address(user_meta: Any, channel: NotificationChannel) -> str | None:
    """The user's address on an external provider, stored in user meta as ``<provider>_id`` (e.g. ``slack_id``)."""
    key = f"{channel.value.lower()}_id"
    return user_meta.get(key) if isinstance(user_meta, dict) else getattr(user_meta, key, None)


async def _notify_users(
    event: NotificationEvent,
    session: AsyncSession,
    users: list[Any],
    entity_name: str | None,
    outbox_id: UUID | None,
) -> None:
    """Deliver the event to the users: always in-app, plus every external channel (Slack, ...) that
    their preference for this event type enables."""
    users = list({str(user.id): user for user in users}.values())
    if not users:
        return

    await deliver_in_app_notifications(
        [_build_message(event, user.id, NotificationChannel.IN_APP, entity_name) for user in users],
        outbox_id=outbox_id,
    )

    preferences = await get_notification_preference_service(session=session).query_all(
        filter={"user_id__in": [user.id for user in users], "event_type": event.event_type},
        fields={"user_id": None, "channels": None},
    )
    users_by_id = {str(user.id): user for user in users}
    for preference in preferences:
        user = users_by_id[str(preference.user_id)]
        for channel in [NotificationChannel(c) for c in preference.channels]:
            if channel == NotificationChannel.IN_APP:
                continue
            address = _get_provider_address(user.meta, channel)
            if not address:
                logger.debug(f"User {user.id} enabled {channel.value} but has no address for it, skipping")
                continue
            body = {**_build_message(event, user.id, channel, entity_name), "channel": address}
            try:
                await _dispatch_notification(body)
                logger.info(f"Notification dispatched to user {user.id} via {channel.value}")
            except Exception as e:
                logger.error(f"Failed to notify user {user.id} via {channel.value}: {e}", exc_info=True)


async def _active_users(session: AsyncSession, user_ids: set[str]) -> list[Any]:
    ids = [UUID(uid) for uid in user_ids if is_valid_uuid(uid)]
    if not ids:
        return []
    users = await get_user_service(session=session).query_all(
        filter={"id__in": ids}, fields={"id": None, "meta": None, "deactivated": None}
    )
    return [user for user in users if not user.deactivated]


async def _without(session: AsyncSession, users: list[Any], excluded_ids: Iterable[UUID | str | None]) -> list[Any]:
    """The users not among ``excluded_ids``, comparing primary accounts so linked accounts count as one user."""
    excluded_ids = list(excluded_ids)
    primary_ids = await resolve_primary_ids(session, [*(user.id for user in users), *excluded_ids])
    excluded = {primary_ids[UUID(str(i))] for i in excluded_ids if i and is_valid_uuid(str(i))}
    return [user for user in users if primary_ids[UUID(str(user.id))] not in excluded]


async def _approval_recipients(
    session: AsyncSession, resource: ResourceResponse, requester_id: str | None
) -> list[Any]:
    """The users who can approve the resource, or super admins when there are none. Never the requester."""
    approvers = await _without(
        session, await _active_users(session, await get_resource_approver_ids(resource)), [requester_id]
    )
    if not approvers:
        approvers = await _without(
            session, await _active_users(session, await get_super_admin_user_ids()), [requester_id]
        )
    if not approvers:
        logger.warning(f"No approvers found for resource {resource.id}, approval notification not sent")
    return approvers


async def _subscriber_recipients(
    event: NotificationEvent, session: AsyncSession, resource: ResourceResponse | None
) -> list[Any]:
    """Active users subscribed to the entity, to every entity of its type, or to the resource's project."""
    subscription_service = get_subscription_service(session)
    sub_fields: FieldSpec = {
        "entity_type": None,
        "entity_id": None,
        "user": cast(FieldSpec, {"id": None, "meta": None, "deactivated": None}),
    }

    project_specific = []
    if resource and resource.project_id:
        project_specific = await subscription_service.query_all(
            filter={"entity_type": "project", "entity_id": resource.project_id}, fields=sub_fields
        )
    specific = await subscription_service.query_all(
        filter={"entity_type": event.entity_type, "entity_id": event.entity_id}, fields=sub_fields
    )
    wildcard = await subscription_service.query_all(
        filter={"entity_type": event.entity_type, "entity_id": None}, fields=sub_fields
    )

    users = [sub.user for sub in specific + wildcard + project_specific if not sub.user.deactivated]
    if not users:
        logger.debug(f"No subscriptions found for {event.entity_type}:{event.entity_id}")
    return users


async def _route_notification_event(
    event: NotificationEvent, session: AsyncSession, outbox_id: UUID | None = None
) -> None:
    """Resolve the recipients of an event and deliver it to them.

    - APPROVAL_REQUIRED goes to the resource's approvers, APPROVAL_RESULT to the user who requested
      the change; every other event goes to the entity's subscribers, except the users the event
      excludes (the actor, and whoever gets a more specific notification about the same change).
    - Every recipient gets the event in-app; preferences add external channels such as Slack.
    """
    resource: ResourceResponse | None = None
    if event.entity_type == "resource" and event.entity_id is not None:
        resource = await get_resource_service(session=session).get_by_id(event.entity_id)
        if not resource:
            logger.warning(f"Resource with ID {event.entity_id} not found, cannot route notification")
            return

    entity_name = event.entity_name or (resource.name if resource else None)

    if event.event_type == EventType.APPROVAL_REQUIRED:
        if resource is None:
            logger.warning(f"Approval notifications are not supported for {event.entity_type}:{event.entity_id}")
            return
        recipients = await _approval_recipients(session, resource, event.actor_id)
    elif event.event_type == EventType.APPROVAL_RESULT:
        # Nobody is told about their own decision
        recipients = await _without(session, await _active_users(session, {event.recipient_id or ""}), [event.actor_id])
    else:
        excluded: list[UUID | str | None] = [event.actor_id, *event.exclude_user_ids]
        if event.exclude_approvers and resource is not None:
            excluded += [user.id for user in await _approval_recipients(session, resource, event.actor_id)]
        recipients = await _without(session, await _subscriber_recipients(event, session, resource), excluded)

    await _notify_users(event, session, recipients, entity_name, outbox_id)


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
                await _route_notification_event(event, session, outbox_id=item.id)
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
