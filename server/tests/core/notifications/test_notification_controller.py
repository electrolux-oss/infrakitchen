# pyright: reportAttributeAccessIssue=false
from uuid import uuid4
from unittest.mock import AsyncMock, Mock

import pytest

from sqlalchemy.ext.asyncio import AsyncSession

from core.constants.model import EventType
from core.notifications.controller import NotificationEvent
import application.tools.notification_manager as notification_manager_module
from application.tools.notification_manager import _route_notification_event


@pytest.fixture
def mock_session():
    return Mock(spec=AsyncSession)


@pytest.fixture(autouse=True)
def mock_deliver_in_app(monkeypatch):
    deliver = AsyncMock()
    monkeypatch.setattr(notification_manager_module, "deliver_in_app_notifications", deliver)
    return deliver


class TestRouteNotificationEvent:
    @pytest.mark.asyncio
    async def test_route_notification_sends_in_app_and_slack_messages_for_subscribed_user(
        self,
        mock_session,
        mock_deliver_in_app,
        mock_subscription_service,
        mock_notification_preference_service,
        mocked_subscription,
        mocked_notification_preference,
        monkeypatch,
        mock_resource_crud,
        mocked_resource,
    ):
        mocked_subscription.entity_id = uuid4()
        mocked_notification_preference.user_id = mocked_subscription.user_id
        mocked_notification_preference.user = mocked_subscription.user

        mock_subscription_service.query_all = AsyncMock(side_effect=[[mocked_subscription], []])
        mock_notification_preference_service.query_all = AsyncMock(return_value=[mocked_notification_preference])
        mock_resource_crud.get_by_id = AsyncMock(return_value=mocked_resource)

        monkeypatch.setattr(
            notification_manager_module,
            "get_resource_service",
            lambda session: mock_resource_crud,
        )
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
        monkeypatch.setattr(notification_manager_module.pubsub, "publish", mock_send_message)
        monkeypatch.setattr(notification_manager_module, "_dispatch_notification", mock_dispatch_notification)

        event = NotificationEvent(
            event_type=EventType.UPDATE,
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
            "event_type": "update",
            "entity_type": "resource",
            "entity_id": str(mocked_subscription.entity_id),
            "entity_name": mocked_resource.name,
            "provider": "in_app",
            "user_id": str(mocked_subscription.user_id),
        }
        slack_body = {
            "msg": "Deployment complete",
            "title": "Resource updated",
            "status": "info",
            "event_type": "update",
            "entity_type": "resource",
            "entity_id": str(mocked_subscription.entity_id),
            "entity_name": mocked_resource.name,
            "provider": "slack",
            "user_id": str(mocked_subscription.user_id),
            "channel": "U123",
        }

        # In-app is always delivered; the SLACK preference adds Slack
        mock_deliver_in_app.assert_awaited_once_with([in_app_body])
        mock_dispatch_notification.assert_awaited_once_with(slack_body)

    @pytest.mark.asyncio
    async def test_route_notification_no_subscriptions_sends_nothing(
        self,
        mock_session,
        mock_subscription_service,
        mock_notification_preference_service,
        monkeypatch,
        mock_resource_crud,
        mocked_resource,
    ):
        mock_subscription_service.query_all = AsyncMock(return_value=[])
        mock_notification_preference_service.query_all = AsyncMock(return_value=[])
        mock_resource_crud.get_by_id = AsyncMock(return_value=mocked_resource)

        monkeypatch.setattr(
            notification_manager_module,
            "get_resource_service",
            lambda session: mock_resource_crud,
        )
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
        monkeypatch.setattr(notification_manager_module.pubsub, "publish", mock_send_message)
        monkeypatch.setattr(notification_manager_module, "_dispatch_notification", mock_dispatch_notification)

        event = NotificationEvent(
            event_type=EventType.UPDATE,
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
        mock_resource_crud,
        mocked_resource,
    ):
        mocked_subscription.user.deactivated = True

        mock_subscription_service.query_all = AsyncMock(side_effect=[[mocked_subscription], []])
        mock_notification_preference_service.query_all = AsyncMock(return_value=[mocked_notification_preference])
        mock_resource_crud.get_by_id = AsyncMock(return_value=mocked_resource)

        monkeypatch.setattr(
            notification_manager_module,
            "get_resource_service",
            lambda session: mock_resource_crud,
        )
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
        monkeypatch.setattr(notification_manager_module.pubsub, "publish", mock_send_message)
        monkeypatch.setattr(notification_manager_module, "_dispatch_notification", mock_dispatch_notification)

        event = NotificationEvent(
            event_type=EventType.UPDATE,
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
        mock_deliver_in_app,
        mock_subscription_service,
        mock_notification_preference_service,
        mocked_subscription,
        mocked_notification_preference,
        mock_resource_crud,
        mocked_resource,
        monkeypatch,
    ):
        mocked_subscription.user.meta = {}  # no slack_id
        mocked_notification_preference.user_id = mocked_subscription.user_id
        mocked_notification_preference.user = mocked_subscription.user
        mocked_notification_preference.channels = ["SLACK"]
        mock_resource_crud.get_by_id = AsyncMock(return_value=mocked_resource)

        mock_subscription_service.query_all = AsyncMock(side_effect=[[mocked_subscription], []])
        mock_notification_preference_service.query_all = AsyncMock(return_value=[mocked_notification_preference])

        monkeypatch.setattr(
            notification_manager_module,
            "get_resource_service",
            lambda session: mock_resource_crud,
        )
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
        monkeypatch.setattr(notification_manager_module.pubsub, "publish", mock_send_message)
        monkeypatch.setattr(notification_manager_module, "_dispatch_notification", mock_dispatch_notification)

        event = NotificationEvent(
            event_type=EventType.UPDATE,
            entity_type="resource",
            title="No slack",
            status="info",
            message="Slack not configured",
            entity_id=str(mocked_subscription.entity_id),
        )

        await _route_notification_event(event, mock_session)

        mock_deliver_in_app.assert_awaited_once()
        mock_dispatch_notification.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_route_notification_delivers_in_app_without_preferences(
        self,
        mock_session,
        mock_deliver_in_app,
        mock_subscription_service,
        mock_notification_preference_service,
        mocked_subscription,
        mock_resource_crud,
        mocked_resource,
        monkeypatch,
    ):
        mock_resource_crud.get_by_id = AsyncMock(return_value=mocked_resource)
        mock_subscription_service.query_all = AsyncMock(side_effect=[[mocked_subscription], []])
        mock_notification_preference_service.query_all = AsyncMock(return_value=[])
        monkeypatch.setattr(notification_manager_module, "get_resource_service", lambda session: mock_resource_crud)
        monkeypatch.setattr(
            notification_manager_module, "get_subscription_service", lambda session: mock_subscription_service
        )
        monkeypatch.setattr(
            notification_manager_module,
            "get_notification_preference_service",
            lambda session: mock_notification_preference_service,
        )
        mock_dispatch_notification = AsyncMock()
        monkeypatch.setattr(notification_manager_module, "_dispatch_notification", mock_dispatch_notification)

        event = NotificationEvent(
            event_type=EventType.EXECUTE,
            entity_type="resource",
            title="Resource dryrun succeeded",
            status="success",
            message="done",
            entity_id=str(mocked_subscription.entity_id),
        )

        await _route_notification_event(event, mock_session)

        [messages] = mock_deliver_in_app.await_args.args
        assert [(m["user_id"], m["provider"]) for m in messages] == [(str(mocked_subscription.user_id), "in_app")]
        mock_dispatch_notification.assert_not_awaited()
