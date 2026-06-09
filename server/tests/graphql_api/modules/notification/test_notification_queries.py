import pytest
from unittest.mock import AsyncMock, Mock, patch

from graphql_api.schema import schema

QUERY_GET_SUBSCRIPTION = """
            query GetSubscription($id: UUID!) {
                subscription(id: $id) {
                    id
                    entityType
                    entityId
                }
            }
        """

QUERY_GET_SUBSCRIPTIONS = """
            query GetSubscriptions {
                subscriptions {
                    id
                    entityType
                    entityId
                }
            }
        """

QUERY_GET_SUBSCRIPTIONS_COUNT = """
            query GetSubscriptionsCount {
                subscriptionsCount
            }
        """

QUERY_GET_NOTIFICATION_PREFERENCE = """
            query GetNotificationPreference($id: UUID!) {
                notificationPreference(id: $id) {
                    id
                }
            }
        """

QUERY_GET_NOTIFICATION_PREFERENCES = """
            query GetNotificationPreferences {
                notificationPreferences {
                    id
                }
            }
        """

QUERY_GET_NOTIFICATION_PREFERENCES_COUNT = """
            query GetNotificationPreferencesCount {
                notificationPreferencesCount
            }
        """


class TestSubscriptionQueries:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.queries.get_subscription_service")
    async def test_subscription_returns_subscription_by_id(
        self,
        mock_get_service,
        mock_subscription_service,
        mock_subscription_crud,
        mocked_subscription,
        mocked_user,
    ):
        mock_subscription_crud.get_by_id = AsyncMock(return_value=mocked_subscription)
        mock_get_service.return_value = mock_subscription_service

        result = await schema.execute(
            QUERY_GET_SUBSCRIPTION,
            variable_values={"id": str(mocked_subscription.id)},
            context_value={"session": Mock(), "user": mocked_user},
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["subscription"]["id"] == str(mocked_subscription.id)
        assert result.data["subscription"]["entityType"] == mocked_subscription.entity_type
        assert result.data["subscription"]["entityId"] == str(mocked_subscription.entity_id)
        mock_subscription_crud.get_by_id.assert_awaited_once()
        call_args = mock_subscription_crud.get_by_id.call_args
        assert call_args.args[0] == mocked_subscription.id

    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.queries.get_subscription_service")
    async def test_subscription_returns_none_when_not_found(
        self,
        mock_get_service,
        mock_subscription_service,
        mock_subscription_crud,
        mocked_subscription,
        mocked_user,
    ):
        mock_subscription_crud.get_by_id = AsyncMock(return_value=None)
        mock_get_service.return_value = mock_subscription_service

        result = await schema.execute(
            QUERY_GET_SUBSCRIPTION,
            variable_values={"id": str(mocked_subscription.id)},
            context_value={"session": Mock(), "user": mocked_user},
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["subscription"] is None
        mock_subscription_crud.get_by_id.assert_awaited_once()
        call_args = mock_subscription_crud.get_by_id.call_args
        assert call_args.args[0] == mocked_subscription.id

    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.queries.get_subscription_service")
    async def test_subscription_requires_authentication(
        self,
        mock_get_service,
        mock_subscription_service,
        mock_subscription_crud,
        mocked_subscription,
    ):
        mock_subscription_crud.get_by_id = AsyncMock(return_value=mocked_subscription)
        mock_get_service.return_value = mock_subscription_service

        result = await schema.execute(
            QUERY_GET_SUBSCRIPTION,
            variable_values={"id": str(mocked_subscription.id)},
            context_value={"session": Mock()},
        )

        assert result.data is None or result.data["subscription"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_subscription_crud.get_by_id.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.queries.get_subscription_service")
    async def test_subscription_returns_error_when_database_fails(
        self,
        mock_get_service,
        mock_subscription_service,
        mock_subscription_crud,
        mocked_subscription,
        mocked_user,
    ):
        mock_subscription_crud.get_by_id.side_effect = RuntimeError("DB error")
        mock_get_service.return_value = mock_subscription_service

        result = await schema.execute(
            QUERY_GET_SUBSCRIPTION,
            variable_values={"id": str(mocked_subscription.id)},
            context_value={"session": Mock(), "user": mocked_user},
        )

        assert result.data is None or result.data["subscription"] is None
        assert result.errors is not None
        assert any("DB error" in error.message for error in result.errors)
        mock_subscription_crud.get_by_id.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.queries.get_subscription_service")
    async def test_subscriptions_returns_subscriptions(
        self,
        mock_get_service,
        mock_subscription_service,
        mock_subscription_crud,
        mocked_subscription,
        mocked_user,
    ):
        mock_subscription_crud.get_all = AsyncMock(return_value=[mocked_subscription])
        mock_get_service.return_value = mock_subscription_service

        result = await schema.execute(
            QUERY_GET_SUBSCRIPTIONS,
            context_value={"session": Mock(), "user": mocked_user},
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["subscriptions"] == [
            {
                "id": str(mocked_subscription.id),
                "entityType": mocked_subscription.entity_type,
                "entityId": str(mocked_subscription.entity_id),
            }
        ]
        mock_subscription_crud.get_all.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.queries.get_subscription_service")
    async def test_subscriptions_count_returns_count(
        self,
        mock_get_service,
        mock_subscription_service,
        mock_subscription_crud,
        mocked_user,
    ):
        mock_subscription_crud.count = AsyncMock(return_value=1)
        mock_get_service.return_value = mock_subscription_service

        result = await schema.execute(
            QUERY_GET_SUBSCRIPTIONS_COUNT,
            context_value={"session": Mock(), "user": mocked_user},
        )

        assert result.errors is None
        assert result.data == {"subscriptionsCount": 1}
        mock_subscription_crud.count.assert_awaited_once()


class TestNotificationPreferenceQueries:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.queries.get_notification_preference_service")
    async def test_notification_preference_returns_preference_by_id(
        self,
        mock_get_service,
        mock_notification_preference_service,
        mock_notification_preference_crud,
        mocked_notification_preference,
        mocked_user,
    ):
        mock_notification_preference_crud.get_by_id = AsyncMock(return_value=mocked_notification_preference)
        mock_get_service.return_value = mock_notification_preference_service

        result = await schema.execute(
            QUERY_GET_NOTIFICATION_PREFERENCE,
            variable_values={"id": str(mocked_notification_preference.id)},
            context_value={"session": Mock(), "user": mocked_user},
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["notificationPreference"]["id"] == str(mocked_notification_preference.id)
        mock_notification_preference_crud.get_by_id.assert_awaited_once()
        call_args = mock_notification_preference_crud.get_by_id.call_args
        assert call_args.args[0] == mocked_notification_preference.id

    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.queries.get_notification_preference_service")
    async def test_notification_preferences_returns_preferences(
        self,
        mock_get_service,
        mock_notification_preference_service,
        mock_notification_preference_crud,
        mocked_notification_preference,
        mocked_user,
    ):
        mock_notification_preference_crud.get_all = AsyncMock(return_value=[mocked_notification_preference])
        mock_get_service.return_value = mock_notification_preference_service

        result = await schema.execute(
            QUERY_GET_NOTIFICATION_PREFERENCES,
            context_value={"session": Mock(), "user": mocked_user},
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["notificationPreferences"] == [{"id": str(mocked_notification_preference.id)}]
        mock_notification_preference_crud.get_all.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.notification.queries.get_notification_preference_service")
    async def test_notification_preferences_count_returns_count(
        self,
        mock_get_service,
        mock_notification_preference_service,
        mock_notification_preference_crud,
        mocked_user,
    ):
        mock_notification_preference_crud.count = AsyncMock(return_value=1)
        mock_get_service.return_value = mock_notification_preference_service

        result = await schema.execute(
            QUERY_GET_NOTIFICATION_PREFERENCES_COUNT,
            context_value={"session": Mock(), "user": mocked_user},
        )

        assert result.errors is None
        assert result.data == {"notificationPreferencesCount": 1}
        mock_notification_preference_crud.count.assert_awaited_once()
