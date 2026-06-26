from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest

from graphql_api.schema import schema

FEATURE_FLAGS_QUERY = """
    query FeatureFlags {
        featureFlags {
            name
            configName
            enabled
        }
    }
"""

UPDATE_FEATURE_FLAG_MUTATION = """
    mutation UpdateFeatureFlag($input: FeatureFlagUpdateInput!) {
        updateFeatureFlag(input: $input) {
            name
            configName
            enabled
        }
    }
"""

RELOAD_FEATURE_FLAGS_MUTATION = """
    mutation ReloadFeatureFlags {
        reloadFeatureFlags {
            status
        }
    }
"""

RELOAD_PERMISSIONS_MUTATION = """
    mutation ReloadPermissions {
        reloadPermissions {
            status
        }
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestAdministrationGraphql:
    @pytest.mark.asyncio
    @patch("graphql_api.helpers.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.modules.administration.queries.get_feature_flag_service")
    async def test_feature_flags_returns_flags(
        self,
        mock_get_service,
        mock_is_super_admin,
        mocked_user,
    ):
        mock_is_super_admin.return_value = True
        service = Mock()
        service.get_all = AsyncMock(
            return_value=[
                Mock(
                    model_dump=lambda: {
                        "name": "flagA",
                        "config_name": "flag_a",
                        "enabled": True,
                        "updated_by": None,
                    }
                )
            ]
        )
        mock_get_service.return_value = service

        result = await schema.execute(FEATURE_FLAGS_QUERY, context_value=make_context(mocked_user))

        assert result.errors is None
        assert result.data == {"featureFlags": [{"name": "flagA", "configName": "flag_a", "enabled": True}]}

    @pytest.mark.asyncio
    @patch(
        "graphql_api.modules.administration.mutations.FeatureFlagEnforcer.send_reload_configs_event",
        new_callable=AsyncMock,
    )
    @patch("graphql_api.modules.administration.mutations.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.helpers.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.modules.administration.mutations.get_feature_flag_service")
    async def test_update_feature_flag_returns_updated(
        self,
        mock_get_service,
        mock_permission_is_super_admin,
        mock_is_super_admin,
        mock_reload,
        mocked_user,
    ):
        mock_permission_is_super_admin.return_value = True
        mock_is_super_admin.return_value = True
        service = Mock()
        service.update_config = AsyncMock(
            return_value=Mock(
                model_dump=lambda: {
                    "name": "flagA",
                    "config_name": "flag_a",
                    "enabled": False,
                    "updated_by": None,
                }
            )
        )
        mock_get_service.return_value = service

        result = await schema.execute(
            UPDATE_FEATURE_FLAG_MUTATION,
            variable_values={"input": {"name": "flagA", "enabled": False}},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"updateFeatureFlag": {"name": "flagA", "configName": "flag_a", "enabled": False}}
        mock_reload.assert_awaited_once()

    @pytest.mark.asyncio
    @patch(
        "graphql_api.modules.administration.mutations.FeatureFlagEnforcer.send_reload_configs_event",
        new_callable=AsyncMock,
    )
    @patch("graphql_api.modules.administration.mutations.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.helpers.user_is_super_admin", new_callable=AsyncMock)
    async def test_reload_feature_flags_returns_status(
        self,
        mock_permission_is_super_admin,
        mock_is_super_admin,
        mock_reload,
        mocked_user,
    ):
        mock_permission_is_super_admin.return_value = True
        mock_is_super_admin.return_value = True

        result = await schema.execute(
            RELOAD_FEATURE_FLAGS_MUTATION,
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"reloadFeatureFlags": {"status": "ok"}}
        mock_reload.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.administration.mutations.CasbinEnforcer.send_reload_event", new_callable=AsyncMock)
    @patch("graphql_api.modules.administration.mutations.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.helpers.user_is_super_admin", new_callable=AsyncMock)
    async def test_reload_permissions_returns_status(
        self,
        mock_permission_is_super_admin,
        mock_is_super_admin,
        mock_reload,
        mocked_user,
    ):
        mock_permission_is_super_admin.return_value = True
        mock_is_super_admin.return_value = True

        result = await schema.execute(
            RELOAD_PERMISSIONS_MUTATION,
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"reloadPermissions": {"status": "ok"}}
        mock_reload.assert_awaited_once()
