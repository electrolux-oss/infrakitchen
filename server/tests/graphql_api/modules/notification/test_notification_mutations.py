from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest

from core.notifications.model import NotificationChannel, NotificationPreference, Subscription
from graphql_api.schema import schema

CREATE_SUBSCRIPTION_MUTATION = """
    mutation CreateSubscription($input: SubscriptionCreateInput!) {
        createSubscription(input: $input) {
            id
            entityType
            entityId
        }
    }
"""

DELETE_SUBSCRIPTION_MUTATION = """
    mutation DeleteSubscription($id: UUID!) {
        deleteSubscription(id: $id)
    }
"""

CREATE_NOTIFICATION_PREFERENCE_MUTATION = """
    mutation CreateNotificationPreference($input: NotificationPreferenceCreateInput!) {
        createNotificationPreference(input: $input) {
            id
        }
    }
"""

DELETE_NOTIFICATION_PREFERENCE_MUTATION = """
    mutation DeleteNotificationPreference($id: UUID!) {
        deleteNotificationPreference(id: $id)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


def build_subscription(
    *,
    user_id,
    entity_type: str,
    entity_id,
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
):
    return Subscription(
        id=uuid4(),
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        created_at=created_at or datetime.now(UTC),
        updated_at=updated_at or datetime.now(UTC),
    )


def build_notification_preference(
    *,
    user_id,
    event_type: str,
    channels: list[NotificationChannel],
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
):
    return NotificationPreference(
        id=uuid4(),
        user_id=user_id,
        event_type=event_type,
        channels=channels,
        created_at=created_at or datetime.now(UTC),
        updated_at=updated_at or datetime.now(UTC),
    )


class TestSubscriptionMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.mutations.get_subscription_service")
    async def test_create_subscription_returns_created_subscription(
        self,
        mock_get_service,
        mock_subscription_service,
        mock_subscription_crud,
        mocked_subscription,
        mocked_user,
    ):
        created_subscription = build_subscription(
            user_id=str(mocked_user.id),
            entity_type="resource",
            entity_id=str(uuid4()),
        )
        mock_subscription_crud.create.return_value = created_subscription
        mock_subscription_crud.get_by_id.return_value = mocked_subscription
        mock_get_service.return_value = mock_subscription_service

        result = await schema.execute(
            CREATE_SUBSCRIPTION_MUTATION,
            variable_values={
                "input": {
                    "entityType": "resource",
                    "entityId": str(created_subscription.entity_id),
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createSubscription"] == {
            "id": str(mocked_subscription.id),
            "entityType": mocked_subscription.entity_type,
            "entityId": str(mocked_subscription.entity_id),
        }
        mock_subscription_crud.create.assert_awaited_once()
        assert mock_subscription_crud.create.call_args.args[0] == {
            "user_id": str(mocked_user.id),
            "entity_type": "resource",
            "entity_id": str(created_subscription.entity_id),
        }
        assert mock_subscription_crud.get_by_id.await_count >= 1
        last_call = mock_subscription_crud.get_by_id.await_args_list[-1]
        assert last_call.args[0] == created_subscription.id

    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.mutations.user_is_super_admin")
    @patch("graphql_api.modules.notification.mutations.get_subscription_service")
    async def test_create_subscription_denies_other_user_without_super_admin(
        self,
        mock_get_service,
        mock_is_super_admin,
        mock_subscription_service,
        mock_subscription_crud,
        mocked_user,
    ):
        other_user_id = str(uuid4())
        mock_is_super_admin.return_value = False
        mock_get_service.return_value = mock_subscription_service

        result = await schema.execute(
            CREATE_SUBSCRIPTION_MUTATION,
            variable_values={
                "input": {
                    "entityType": "resource",
                    "entityId": str(uuid4()),
                    "userId": other_user_id,
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["createSubscription"] is None
        assert result.errors is not None
        assert any(
            "Only super admins can create subscriptions for other users" in error.message for error in result.errors
        )
        mock_subscription_crud.create.assert_not_awaited()
        mock_subscription_crud.get_by_id.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.mutations.get_subscription_service")
    async def test_delete_subscription_returns_true_for_owner(
        self,
        mock_get_service,
        mock_subscription_service,
        mock_subscription_crud,
        mocked_user,
    ):
        subscription = build_subscription(
            user_id=str(mocked_user.id),
            entity_type="resource",
            entity_id=uuid4(),
        )
        mock_subscription_crud.get_by_id.return_value = subscription
        mock_get_service.return_value = mock_subscription_service

        result = await schema.execute(
            DELETE_SUBSCRIPTION_MUTATION,
            variable_values={"id": str(subscription.id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteSubscription": True}
        assert mock_subscription_crud.get_by_id.await_count >= 1
        last_call = mock_subscription_crud.get_by_id.await_args_list[-1]
        assert last_call.args[0] == subscription.id
        mock_subscription_crud.delete.assert_awaited_once_with(subscription)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.mutations.get_subscription_service")
    async def test_delete_subscription_returns_error_when_not_found(
        self,
        mock_get_service,
        mock_subscription_service,
        mock_subscription_crud,
        mocked_user,
    ):
        subscription_id = uuid4()
        mock_subscription_crud.get_by_id.return_value = None
        mock_get_service.return_value = mock_subscription_service

        result = await schema.execute(
            DELETE_SUBSCRIPTION_MUTATION,
            variable_values={"id": str(subscription_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteSubscription"] is None
        assert result.errors is not None
        assert any("Subscription not found" in error.message for error in result.errors)
        mock_subscription_crud.get_by_id.assert_awaited_once_with(subscription_id, fields=None)
        mock_subscription_crud.delete.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.mutations.user_is_super_admin")
    @patch("graphql_api.modules.notification.mutations.get_subscription_service")
    async def test_delete_subscription_denies_other_user_without_super_admin(
        self,
        mock_get_service,
        mock_is_super_admin,
        mock_subscription_service,
        mock_subscription_crud,
        mocked_user,
    ):
        subscription = build_subscription(
            user_id=uuid4(),
            entity_type="resource",
            entity_id=uuid4(),
        )
        mock_subscription_crud.get_by_id.return_value = subscription
        mock_is_super_admin.return_value = False
        mock_get_service.return_value = mock_subscription_service

        result = await schema.execute(
            DELETE_SUBSCRIPTION_MUTATION,
            variable_values={"id": str(subscription.id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteSubscription"] is None
        assert result.errors is not None
        assert any(
            "Only super admins can delete subscriptions of other users" in error.message for error in result.errors
        )
        mock_subscription_crud.get_by_id.assert_awaited_once_with(subscription.id, fields=None)
        mock_subscription_crud.delete.assert_not_awaited()


class TestNotificationPreferenceMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.mutations.get_notification_preference_service")
    async def test_create_notification_preference_returns_created_preference(
        self,
        mock_get_service,
        mock_notification_preference_service,
        mock_notification_preference_crud,
        mocked_notification_preference,
        mocked_user,
    ):
        created_preference = build_notification_preference(
            user_id=str(mocked_user.id),
            event_type="update",
            channels=[NotificationChannel.SLACK, NotificationChannel.IN_APP],
        )
        mock_notification_preference_crud.create.return_value = created_preference
        mock_notification_preference_crud.get_by_id.return_value = mocked_notification_preference
        mock_get_service.return_value = mock_notification_preference_service

        result = await schema.execute(
            CREATE_NOTIFICATION_PREFERENCE_MUTATION,
            variable_values={
                "input": {
                    "eventType": "update",
                    "channels": ["SLACK", "IN_APP"],
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createNotificationPreference"] == {"id": str(mocked_notification_preference.id)}
        mock_notification_preference_crud.create.assert_awaited_once()
        assert mock_notification_preference_crud.create.call_args.args[0] == {
            "user_id": str(mocked_user.id),
            "event_type": "update",
            "channels": [NotificationChannel.SLACK, NotificationChannel.IN_APP],
        }
        mock_notification_preference_crud.get_by_id.assert_awaited_once_with(created_preference.id, fields=None)

    @pytest.mark.asyncio
    @patch("core.notifications.service.user_is_super_admin")
    @patch("graphql_api.modules.notification.mutations.get_notification_preference_service")
    async def test_create_notification_preference_denies_other_user_without_super_admin(
        self,
        mock_get_service,
        mock_is_super_admin,
        mock_notification_preference_service,
        mock_notification_preference_crud,
        mocked_user,
    ):
        other_user_id = str(uuid4())
        mock_is_super_admin.return_value = False
        mock_get_service.return_value = mock_notification_preference_service

        result = await schema.execute(
            CREATE_NOTIFICATION_PREFERENCE_MUTATION,
            variable_values={
                "input": {
                    "eventType": "update",
                    "channels": ["SLACK"],
                    "userId": other_user_id,
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["createNotificationPreference"] is None
        assert result.errors is not None
        assert any(
            "Only super admins can create notification preferences for other users" in error.message
            for error in result.errors
        )
        mock_notification_preference_crud.create.assert_not_awaited()
        mock_notification_preference_crud.get_by_id.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.mutations.get_notification_preference_service")
    async def test_delete_notification_preference_returns_true_for_owner(
        self,
        mock_get_service,
        mock_notification_preference_service,
        mock_notification_preference_crud,
        mocked_user,
    ):
        preference = build_notification_preference(
            user_id=str(mocked_user.id),
            event_type="update",
            channels=[NotificationChannel.SLACK],
        )
        mock_notification_preference_crud.get_by_id.return_value = preference
        mock_get_service.return_value = mock_notification_preference_service

        result = await schema.execute(
            DELETE_NOTIFICATION_PREFERENCE_MUTATION,
            variable_values={"id": str(preference.id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteNotificationPreference": True}
        assert mock_notification_preference_crud.get_by_id.await_count >= 1
        last_call = mock_notification_preference_crud.get_by_id.await_args_list[-1]
        assert last_call.args[0] == preference.id
        mock_notification_preference_crud.delete.assert_awaited_once_with(preference)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.mutations.get_notification_preference_service")
    async def test_delete_notification_preference_returns_error_when_not_found(
        self,
        mock_get_service,
        mock_notification_preference_service,
        mock_notification_preference_crud,
        mocked_user,
    ):
        preference_id = uuid4()
        mock_notification_preference_crud.get_by_id.return_value = None
        mock_get_service.return_value = mock_notification_preference_service

        result = await schema.execute(
            DELETE_NOTIFICATION_PREFERENCE_MUTATION,
            variable_values={"id": str(preference_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteNotificationPreference"] is None
        assert result.errors is not None
        assert any("Notification preference not found" in error.message for error in result.errors)
        mock_notification_preference_crud.get_by_id.assert_awaited_once_with(preference_id, fields=None)
        mock_notification_preference_crud.delete.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("core.notifications.service.user_is_super_admin")
    @patch("graphql_api.modules.notification.mutations.get_notification_preference_service")
    async def test_delete_notification_preference_denies_other_user_without_super_admin(
        self,
        mock_get_service,
        mock_is_super_admin,
        mock_notification_preference_service,
        mock_notification_preference_crud,
        mocked_user,
    ):
        preference = build_notification_preference(
            user_id=uuid4(),
            event_type="update",
            channels=[NotificationChannel.SLACK],
        )
        mock_notification_preference_crud.get_by_id.return_value = preference
        mock_is_super_admin.return_value = False
        mock_get_service.return_value = mock_notification_preference_service

        result = await schema.execute(
            DELETE_NOTIFICATION_PREFERENCE_MUTATION,
            variable_values={"id": str(preference.id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteNotificationPreference"] is None
        assert result.errors is not None
        assert any(
            "Only super admins can delete notification preferences of other users" in error.message
            for error in result.errors
        )
        mock_notification_preference_crud.get_by_id.assert_awaited_once_with(preference.id, fields=None)
        mock_notification_preference_crud.delete.assert_not_awaited()
