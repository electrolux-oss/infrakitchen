from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

import application.tools.notification_manager as notification_manager_module
import core.users.accounts as accounts_module
from application.tools.notification_manager import _route_notification_event
from core.constants.model import EventType
from core.notifications.controller import NotificationEvent


def user():
    return SimpleNamespace(id=uuid4(), meta={}, deactivated=False)


@pytest.fixture
def routing(monkeypatch):
    """Executor events routed against in-memory executor, project and type-wide subscriptions."""
    state = SimpleNamespace(
        executor_id=uuid4(),
        project_id=None,
        executor_subscribers=[],
        project_subscribers=[],
        sent=[],
    )

    async def executor_project(_session, executor_id):
        assert str(executor_id) == str(state.executor_id)
        return state.project_id, "db-migration"

    async def query_subscriptions(filter, fields=None):
        if filter["entity_type"] == "executor" and str(filter["entity_id"]) == str(state.executor_id):
            return [SimpleNamespace(user=u) for u in state.executor_subscribers]
        if filter["entity_type"] == "project" and state.project_id and filter["entity_id"] == state.project_id:
            return [SimpleNamespace(user=u) for u in state.project_subscribers]
        return []

    async def deliver_in_app(messages, outbox_id=None):
        state.sent.extend(messages)

    monkeypatch.setattr(accounts_module, "get_primary_account_ids", AsyncMock(return_value={}))
    monkeypatch.setattr(notification_manager_module, "get_linked_account_ids", AsyncMock(return_value={}))
    monkeypatch.setattr(notification_manager_module, "_executor_project", executor_project)
    monkeypatch.setattr(
        notification_manager_module,
        "get_subscription_service",
        lambda session: Mock(query_all=AsyncMock(side_effect=query_subscriptions)),
    )
    monkeypatch.setattr(
        notification_manager_module,
        "get_notification_preference_service",
        lambda session: Mock(query_all=AsyncMock(return_value=[])),
    )
    monkeypatch.setattr(notification_manager_module, "deliver_in_app_notifications", deliver_in_app)
    return state


def executor_event(executor_id, actor_id=None):
    return NotificationEvent(
        event_type=EventType.EXECUTE,
        entity_type="executor",
        entity_id=str(executor_id),
        title="Apply succeeded",
        status="success",
        message="Apply for executor db-migration completed successfully",
        actor_id=str(actor_id) if actor_id else None,
    )


def recipients(sent):
    return {body["user_id"] for body in sent}


class TestExecutorProjectSubscribers:
    async def test_project_subscribers_get_executor_events(self, routing):
        direct, project_subscriber = user(), user()
        routing.project_id = uuid4()
        routing.executor_subscribers = [direct]
        routing.project_subscribers = [project_subscriber]

        await _route_notification_event(executor_event(routing.executor_id), Mock())

        assert recipients(routing.sent) == {str(direct.id), str(project_subscriber.id)}

    async def test_without_project_only_executor_subscribers(self, routing):
        direct = user()
        routing.executor_subscribers = [direct]

        await _route_notification_event(executor_event(routing.executor_id), Mock())

        assert recipients(routing.sent) == {str(direct.id)}

    async def test_actor_subscribed_through_the_project_is_skipped(self, routing):
        actor, other = user(), user()
        routing.project_id = uuid4()
        routing.project_subscribers = [actor, other]

        await _route_notification_event(executor_event(routing.executor_id, actor.id), Mock())

        assert recipients(routing.sent) == {str(other.id)}
