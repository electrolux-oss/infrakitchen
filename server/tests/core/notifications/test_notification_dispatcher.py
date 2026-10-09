from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from application.tools import notification_manager
from application.tools.notification_manager import NotificationDispatcher
from core.notifications import in_app
from core.notifications.model import OutboxStatus

PAYLOAD = {
    "event_type": "update",
    "entity_type": "resource",
    "title": "Resource r",
    "status": "info",
    "message": "changed",
    "entity_id": None,
    "metadata": None,
}


@pytest.fixture
def outbox(monkeypatch):
    crud = Mock()
    crud.claim = AsyncMock()
    crud.finish = AsyncMock(return_value=True)
    crud.retry = AsyncMock(return_value=True)

    @asynccontextmanager
    async def session():
        yield Mock(commit=AsyncMock())

    monkeypatch.setattr(notification_manager, "get_async_session", session)
    monkeypatch.setattr(notification_manager, "NotificationOutboxCRUD", lambda _session: crud)
    return crud


def item(attempts: int = 1, max_attempts: int = 5):
    return SimpleNamespace(id="item-1", payload=PAYLOAD, attempts=attempts, max_attempts=max_attempts)


class TestDispatchOnce:
    async def test_nothing_to_claim(self, outbox):
        outbox.claim.return_value = None

        assert await NotificationDispatcher(concurrency=1).dispatch_once() is False

    async def test_routes_and_marks_done(self, outbox, monkeypatch):
        route = AsyncMock()
        monkeypatch.setattr(notification_manager, "_route_notification_event", route)
        claimed = item()
        outbox.claim.return_value = claimed

        assert await NotificationDispatcher(concurrency=1).dispatch_once() is True

        event = route.await_args_list[0].args[0]
        assert (event.entity_type, event.title, event.message) == ("resource", "Resource r", "changed")
        outbox.finish.assert_awaited_once_with(claimed, OutboxStatus.DONE, None)

    async def test_failed_routing_is_retried_with_backoff(self, outbox, monkeypatch):
        monkeypatch.setattr(notification_manager, "_route_notification_event", AsyncMock(side_effect=OSError("db")))
        claimed = item(attempts=2)
        outbox.claim.return_value = claimed

        _ = await NotificationDispatcher(concurrency=1).dispatch_once()

        outbox.retry.assert_awaited_once_with(claimed, 10.0, "OSError: db")
        outbox.finish.assert_not_awaited()

    async def test_gives_up_after_max_attempts(self, outbox, monkeypatch):
        monkeypatch.setattr(notification_manager, "_route_notification_event", AsyncMock(side_effect=OSError("db")))
        claimed = item(attempts=5, max_attempts=5)
        outbox.claim.return_value = claimed

        _ = await NotificationDispatcher(concurrency=1).dispatch_once()

        outbox.finish.assert_awaited_once_with(claimed, OutboxStatus.FAILED, "OSError: db")
        outbox.retry.assert_not_awaited()

    async def test_item_whose_claimers_kept_dying_is_failed_without_routing(self, outbox, monkeypatch):
        route = AsyncMock()
        monkeypatch.setattr(notification_manager, "_route_notification_event", route)
        outbox.claim.return_value = item(attempts=6, max_attempts=5)

        _ = await NotificationDispatcher(concurrency=1).dispatch_once()

        route.assert_not_awaited()
        assert outbox.finish.await_args_list[0].args[1] == OutboxStatus.FAILED


class TestInAppDispatch:
    async def test_in_app_is_stored_and_streamed_to_the_users_topic(self, monkeypatch):
        publish = AsyncMock()
        store = AsyncMock(side_effect=lambda msg: {**msg, "id": "n1", "created_at": "2026-10-08T00:00:00+00:00"})
        monkeypatch.setattr(in_app.pubsub, "publish", publish)
        monkeypatch.setattr(in_app, "store_in_app_notification", store)
        body = {"provider": "in_app", "user_id": "u1", "msg": "hi"}

        await notification_manager._dispatch_notification(body)

        store.assert_awaited_once_with(body)
        publish.assert_awaited_once_with(
            "notifications.in_app.u1", {**body, "id": "n1", "created_at": "2026-10-08T00:00:00+00:00"}
        )
