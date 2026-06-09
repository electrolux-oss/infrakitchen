# pyright: reportAttributeAccessIssue=false
from uuid import uuid4
from unittest.mock import AsyncMock, Mock, call

import pytest

from sqlalchemy.ext.asyncio import AsyncSession

from core.notifications.controller import NotificationController, NotificationEvent
import core.notifications.controller as notification_controller_module


@pytest.fixture
def mock_session():
    return Mock(spec=AsyncSession)


class TestNotificationController:
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
        controller = NotificationController(session=mock_session)
        controller.subscription_service = mock_subscription_service
        controller.preference_service = mock_notification_preference_service

        mocked_subscription.entity_id = uuid4()
        mocked_notification_preference.user_id = mocked_subscription.user_id
        mocked_notification_preference.user = mocked_subscription.user

        mock_subscription_service.query_all = AsyncMock(side_effect=[[mocked_subscription], []])
        mock_notification_preference_service.query_all = AsyncMock(return_value=[mocked_notification_preference])

        created_messages: list[dict[str, str]] = []

        def mock_create_message(body):
            created_messages.append(body)
            return body

        mock_send_message = AsyncMock()
        monkeypatch.setattr(notification_controller_module, "create_message", mock_create_message)
        monkeypatch.setattr(notification_controller_module, "send_message", mock_send_message)

        event = NotificationEvent(
            event_type="update",
            entity_type="resource",
            title="Resource updated",
            status="info",
            message="Deployment complete",
            entity_id=str(mocked_subscription.entity_id),
        )

        await controller.route_notification(event)

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

        assert len(created_messages) == 2
        assert {
            "msg": "Deployment complete",
            "title": "Resource updated",
            "status": "info",
            "entity_id": str(mocked_subscription.entity_id),
            "entity_name": "resource",
            "provider": "in_app",
            "user_id": str(mocked_subscription.user_id),
        } in created_messages
        assert {
            "msg": "Deployment complete",
            "title": "Resource updated",
            "status": "info",
            "entity_id": str(mocked_subscription.entity_id),
            "entity_name": "resource",
            "provider": "slack",
            "user_id": str(mocked_subscription.user_id),
            "channel": "U123",
        } in created_messages

        assert mock_send_message.await_count == 2
        mock_send_message.assert_has_awaits([call(created_messages[0]), call(created_messages[1])], any_order=False)
