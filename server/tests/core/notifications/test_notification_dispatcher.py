from contextlib import asynccontextmanager
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql

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

    async def test_routing_is_keyed_by_the_outbox_item(self, outbox, monkeypatch):
        route = AsyncMock()
        monkeypatch.setattr(notification_manager, "_route_notification_event", route)
        outbox.claim.return_value = item()

        _ = await NotificationDispatcher(concurrency=1).dispatch_once()

        route.assert_awaited_once()
        assert route.call_args.kwargs["outbox_id"] == "item-1"


CREATED_AT = datetime(2026, 10, 12, tzinfo=UTC)


@pytest.fixture
def in_app_delivery(monkeypatch):
    """Fake DB session returning ``state.inserted`` user IDs as the rows actually inserted."""
    state = SimpleNamespace(inserted=[], published=[], session=Mock(commit=AsyncMock()))

    async def execute(_statement):
        rows = [SimpleNamespace(id=f"n-{u}", user_id=u, created_at=CREATED_AT) for u in state.inserted]
        return Mock(all=lambda: rows)

    state.session.execute = AsyncMock(side_effect=execute)

    @asynccontextmanager
    async def fake_session(_engine):
        yield state.session

    async def publish_many(messages):
        state.published.extend(messages)

    monkeypatch.setattr(in_app, "AsyncSession", fake_session)
    monkeypatch.setattr(in_app.pubsub, "publish_many", publish_many)
    return state


def inserted_rows(statement: Any) -> list[dict[str, Any]]:
    return [{column.key: value for column, value in row.items()} for row in statement._multi_values[0]]


class TestInAppDelivery:
    async def test_batch_is_stored_once_per_primary_account_and_streamed(self, monkeypatch, in_app_delivery):
        primary, secondary, other = uuid4(), uuid4(), uuid4()
        in_app_delivery.inserted = [primary, other]
        monkeypatch.setattr(in_app, "get_primary_account_ids", AsyncMock(return_value={secondary: primary}))

        await in_app.deliver_in_app_notifications(
            [{"user_id": str(u), "msg": "hi", "provider": "in_app"} for u in (primary, secondary, other)]
        )

        statement = in_app_delivery.session.execute.await_args.args[0]
        assert [row["user_id"] for row in inserted_rows(statement)] == [primary, other]
        published = in_app_delivery.published
        assert [topic for topic, _ in published] == [
            f"notifications.in_app.{primary}",
            f"notifications.in_app.{other}",
        ]
        assert published[0][1]["id"] == f"n-{primary}"
        assert published[0][1]["created_at"] == CREATED_AT.isoformat()

    async def test_retry_skips_recipients_already_reached(self, monkeypatch, in_app_delivery):
        reached, missed = uuid4(), uuid4()
        outbox_id = uuid4()
        # The unique (outbox_id, user_id) index drops the row stored by the previous attempt
        in_app_delivery.inserted = [missed]
        monkeypatch.setattr(in_app, "get_primary_account_ids", AsyncMock(return_value={}))

        await in_app.deliver_in_app_notifications(
            [{"user_id": str(u), "msg": "hi", "provider": "in_app"} for u in (reached, missed)], outbox_id=outbox_id
        )

        statement = in_app_delivery.session.execute.await_args.args[0]
        assert {row["outbox_id"] for row in inserted_rows(statement)} == {outbox_id}
        assert "ON CONFLICT (outbox_id, user_id) WHERE outbox_id IS NOT NULL DO NOTHING" in str(
            statement.compile(dialect=postgresql.dialect())
        )
        assert [topic for topic, _ in in_app_delivery.published] == [f"notifications.in_app.{missed}"]
