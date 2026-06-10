# pyright: reportAttributeAccessIssue=false
from typing import Any
from uuid import uuid4
from unittest.mock import AsyncMock, Mock

import pytest

from sqlalchemy.ext.asyncio import AsyncSession

from core.notifications.controller import NotificationEvent
import application.tools.notification_manager as notification_manager_module
from application.tools.notification_manager import _route_notification_event


@pytest.fixture
def mock_session():
    return Mock(spec=AsyncSession)


class TestRouteNotificationEvent:
    @pytest.mark.asyncio
    async def test_route_notification_sends_in_app_and_slack_messages_for_subscribed_user(
        self,
        mock_session,
        mock_subscription_service,
        mock_notification_preference_service,
        mocked_subscription,
        mocked_notification_preference,
        monkeypatch,
    ):
        mocked_subscription.entity_id = uuid4()
        mocked_notification_preference.user_id = mocked_subscription.user_id
        mocked_notification_preference.user = mocked_subscription.user

        mock_subscription_service.query_all = AsyncMock(side_effect=[[mocked_subscription], []])
        mock_notification_preference_service.query_all = AsyncMock(return_value=[mocked_notification_preference])

        monkeypatch.setattr(
            notification_manager_module,
            "get_subscription_service",
            lambda session: mock_subscription_service,
        )
        monkeypatch.setattr(
            notification_manager_module,
            "get_notification_preference_service",
            lambda session: mock_notification_preference_service,
        )

        created_messages: list[dict[str, Any]] = []

        def mock_create_message(body):
            created_messages.append(body)
            return body

        mock_send_message = AsyncMock()
        mock_dispatch_notification = AsyncMock()
        monkeypatch.setattr(notification_manager_module, "create_in_app_message", mock_create_message)
        monkeypatch.setattr(notification_manager_module, "send_message", mock_send_message)
        monkeypatch.setattr(notification_manager_module, "_dispatch_notification", mock_dispatch_notification)

        event = NotificationEvent(
            event_type="update",
            entity_type="resource",
            title="Resource updated",
            status="info",
            message="Deployment complete",
            entity_id=str(mocked_subscription.entity_id),
        )

        await _route_notification_event(event, mock_session)

        assert mock_subscription_service.query_all.await_count == 2
        specific_call = mock_subscription_service.query_all.await_args_list[0]
        wildcard_call = mock_subscription_service.query_all.await_args_list[1]
        assert specific_call.kwargs["filter"] == {
            "entity_type": "resource",
            "entity_id": str(mocked_subscription.entity_id),
        }
        assert wildcard_call.kwargs["filter"] == {
            "entity_type": "resource",
            "entity_id": None,
        }

        mock_notification_preference_service.query_all.assert_awaited_once()
        assert mock_notification_preference_service.query_all.await_args
        preference_filter = mock_notification_preference_service.query_all.await_args.kwargs["filter"]
        assert preference_filter["event_type"] == "update"
        assert preference_filter["user_id__in"] == [mocked_subscription.user_id]

        in_app_body = {
            "msg": "Deployment complete",
            "title": "Resource updated",
            "status": "info",
            "entity_id": str(mocked_subscription.entity_id),
            "entity_name": "resource",
            "provider": "in_app",
            "user_id": str(mocked_subscription.user_id),
        }
        slack_body = {
            "msg": "Deployment complete",
            "title": "Resource updated",
            "status": "info",
            "entity_id": str(mocked_subscription.entity_id),
            "entity_name": "resource",
            "provider": "slack",
            "user_id": str(mocked_subscription.user_id),
            "channel": "U123",
        }

        # Both channels go through _dispatch_notification
        assert mock_dispatch_notification.await_count == 2
        mock_dispatch_notification.assert_any_await(in_app_body)
        mock_dispatch_notification.assert_any_await(slack_body)

    @pytest.mark.asyncio
    async def test_route_notification_no_subscriptions_sends_nothing(
        self,
        mock_session,
        mock_subscription_service,
        mock_notification_preference_service,
        monkeypatch,
    ):
        mock_subscription_service.query_all = AsyncMock(return_value=[])
        mock_notification_preference_service.query_all = AsyncMock(return_value=[])

        monkeypatch.setattr(
            notification_manager_module,
            "get_subscription_service",
            lambda session: mock_subscription_service,
        )
        monkeypatch.setattr(
            notification_manager_module,
            "get_notification_preference_service",
            lambda session: mock_notification_preference_service,
        )

        mock_send_message = AsyncMock()
        mock_dispatch_notification = AsyncMock()
        monkeypatch.setattr(notification_manager_module, "send_message", mock_send_message)
        monkeypatch.setattr(notification_manager_module, "_dispatch_notification", mock_dispatch_notification)

        event = NotificationEvent(
            event_type="update",
            entity_type="resource",
            title="No one is watching",
            status="info",
            message="Nothing to send",
            entity_id=str(uuid4()),
        )

        await _route_notification_event(event, mock_session)

        mock_send_message.assert_not_awaited()
        mock_dispatch_notification.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_route_notification_skips_deactivated_user(
        self,
        mock_session,
        mock_subscription_service,
        mock_notification_preference_service,
        mocked_subscription,
        mocked_notification_preference,
        monkeypatch,
    ):
        mocked_subscription.user.deactivated = True

        mock_subscription_service.query_all = AsyncMock(side_effect=[[mocked_subscription], []])
        mock_notification_preference_service.query_all = AsyncMock(return_value=[mocked_notification_preference])

        monkeypatch.setattr(
            notification_manager_module,
            "get_subscription_service",
            lambda session: mock_subscription_service,
        )
        monkeypatch.setattr(
            notification_manager_module,
            "get_notification_preference_service",
            lambda session: mock_notification_preference_service,
        )

        mock_send_message = AsyncMock()
        mock_dispatch_notification = AsyncMock()
        monkeypatch.setattr(notification_manager_module, "send_message", mock_send_message)
        monkeypatch.setattr(notification_manager_module, "_dispatch_notification", mock_dispatch_notification)

        event = NotificationEvent(
            event_type="update",
            entity_type="resource",
            title="Skipped",
            status="info",
            message="User is deactivated",
            entity_id=str(mocked_subscription.entity_id),
        )

        await _route_notification_event(event, mock_session)

        mock_send_message.assert_not_awaited()
        mock_dispatch_notification.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_route_notification_skips_slack_when_no_slack_id(
        self,
        mock_session,
        mock_subscription_service,
        mock_notification_preference_service,
        mocked_subscription,
        mocked_notification_preference,
        monkeypatch,
    ):
        mocked_subscription.user.meta = {}  # no slack_id
        mocked_notification_preference.user_id = mocked_subscription.user_id
        mocked_notification_preference.user = mocked_subscription.user
        mocked_notification_preference.channels = ["SLACK"]

        mock_subscription_service.query_all = AsyncMock(side_effect=[[mocked_subscription], []])
        mock_notification_preference_service.query_all = AsyncMock(return_value=[mocked_notification_preference])

        monkeypatch.setattr(
            notification_manager_module,
            "get_subscription_service",
            lambda session: mock_subscription_service,
        )
        monkeypatch.setattr(
            notification_manager_module,
            "get_notification_preference_service",
            lambda session: mock_notification_preference_service,
        )

        mock_send_message = AsyncMock()
        mock_dispatch_notification = AsyncMock()
        monkeypatch.setattr(notification_manager_module, "send_message", mock_send_message)
        monkeypatch.setattr(notification_manager_module, "_dispatch_notification", mock_dispatch_notification)

        event = NotificationEvent(
            event_type="update",
            entity_type="resource",
            title="No slack",
            status="info",
            message="Slack not configured",
            entity_id=str(mocked_subscription.entity_id),
        )

        await _route_notification_event(event, mock_session)

        mock_send_message.assert_not_awaited()
        mock_dispatch_notification.assert_not_awaited()
