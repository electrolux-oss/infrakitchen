from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi import HTTPException

from graphql_api.schema import schema

REFRESH_AUTH_TOKEN_MUTATION = """
    mutation RefreshAuthToken {
        refreshAuthToken {
            token
            expiration
            provider
        }
    }
"""

SERVICE_ACCOUNT_TOKEN_MUTATION = """
    mutation ServiceAccountToken($identifier: String!, $password: String!) {
        serviceAccountToken(identifier: $identifier, password: $password) {
            token
            expiresAt
        }
    }
"""

LOGOUT_MUTATION = """
    mutation Logout {
        logout {
            success
        }
    }
"""


def make_context(cookies: dict[str, str]):
    request = Mock()
    request.cookies = cookies
    request.state = SimpleNamespace(user=None)
    return {
        "request": request,
        "response": Mock(),
        "session": Mock(),
        "sso_service": Mock(),
        "user": None,
    }


class TestAuthMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.auth.mutations.create_user_token")
    @patch("graphql_api.modules.auth.mutations.is_correct_password")
    async def test_service_account_token_returns_token(
        self,
        mock_is_correct_password,
        mock_create_user_token,
    ):
        mock_service = Mock()
        mock_service.auth_provider_service.get_all = AsyncMock(return_value=[SimpleNamespace(enabled=True)])
        mock_user = SimpleNamespace(password=Mock())
        mock_user.password.get_decrypted_value.return_value = "salt$hashed-password"
        mock_service.user_service.get_user_by_identifier = AsyncMock(return_value=mock_user)
        mock_is_correct_password.return_value = True
        mock_create_user_token.return_value = "service-account-token"

        context = make_context({})
        context["sso_service"] = mock_service

        result = await schema.execute(
            SERVICE_ACCOUNT_TOKEN_MUTATION,
            variable_values={"identifier": "svc-user", "password": "svc-password"},
            context_value=context,
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["serviceAccountToken"]["token"] == "service-account-token"
        assert result.data["serviceAccountToken"]["expiresAt"]
        mock_service.user_service.get_user_by_identifier.assert_awaited_once_with("svc-user")
        mock_is_correct_password.assert_called_once_with("salt", "hashed-password", "svc-password")

    @pytest.mark.asyncio
    async def test_service_account_token_returns_error_when_provider_disabled(self):
        mock_service = Mock()
        mock_service.auth_provider_service.get_all = AsyncMock(return_value=[SimpleNamespace(enabled=False)])

        context = make_context({})
        context["sso_service"] = mock_service

        result = await schema.execute(
            SERVICE_ACCOUNT_TOKEN_MUTATION,
            variable_values={"identifier": "svc-user", "password": "svc-password"},
            context_value=context,
        )

        assert result.data is None or result.data["serviceAccountToken"] is None
        assert result.errors is not None
        assert any("Service Account login is disabled" in error.message for error in result.errors)

    @pytest.mark.asyncio
    async def test_service_account_token_returns_error_for_invalid_credentials(self):
        mock_service = Mock()
        mock_service.auth_provider_service.get_all = AsyncMock(return_value=[SimpleNamespace(enabled=True)])
        mock_service.user_service.get_user_by_identifier = AsyncMock(return_value=None)

        context = make_context({})
        context["sso_service"] = mock_service

        result = await schema.execute(
            SERVICE_ACCOUNT_TOKEN_MUTATION,
            variable_values={"identifier": "svc-user", "password": "svc-password"},
            context_value=context,
        )

        assert result.data is None or result.data["serviceAccountToken"] is None
        assert result.errors is not None
        assert any("Invalid password or username" in error.message for error in result.errors)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.auth.mutations.github_refresh_token", new_callable=AsyncMock)
    @patch("graphql_api.modules.auth.mutations.guest_refresh_token", new_callable=AsyncMock)
    @patch("graphql_api.modules.auth.mutations.microsoft_refresh_token", new_callable=AsyncMock)
    async def test_refresh_auth_token_prefers_microsoft_cookie(
        self,
        mock_microsoft_refresh,
        mock_guest_refresh,
        mock_github_refresh,
    ):
        expiration = datetime.now(UTC)
        mock_microsoft_refresh.return_value = {
            "token": "microsoft-token",
            "expiration": expiration,
        }

        result = await schema.execute(
            REFRESH_AUTH_TOKEN_MUTATION,
            context_value=make_context(
                {
                    "microsoft-refresh-token": "microsoft-cookie",
                    "guest-token": "guest-cookie",
                    "github-refresh-token": "github-cookie",
                }
            ),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["refreshAuthToken"]["token"] == "microsoft-token"
        assert result.data["refreshAuthToken"]["provider"] == "microsoft"
        mock_microsoft_refresh.assert_awaited_once()
        mock_guest_refresh.assert_not_awaited()
        mock_github_refresh.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_refresh_auth_token_returns_error_without_refresh_cookie(self):
        result = await schema.execute(
            REFRESH_AUTH_TOKEN_MUTATION,
            context_value=make_context({}),
        )

        assert result.data is None or result.data["refreshAuthToken"] is None
        assert result.errors is not None
        assert any("Authentication failed" in error.message for error in result.errors)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.auth.mutations.guest_refresh_token", new_callable=AsyncMock)
    @patch("graphql_api.modules.auth.mutations.microsoft_refresh_token", new_callable=AsyncMock)
    async def test_refresh_auth_token_propagates_provider_failure(
        self,
        mock_microsoft_refresh,
        mock_guest_refresh,
    ):
        mock_guest_refresh.side_effect = HTTPException(status_code=401, detail="Invalid token")

        result = await schema.execute(
            REFRESH_AUTH_TOKEN_MUTATION,
            context_value=make_context({"guest-token": "guest-cookie"}),
        )

        assert result.data is None or result.data["refreshAuthToken"] is None
        assert result.errors is not None
        assert any("Invalid token" in error.message for error in result.errors)
        mock_microsoft_refresh.assert_not_awaited()
        mock_guest_refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_logout_deletes_all_cookies(self):
        mock_response = Mock()
        context = make_context({})
        context["response"] = mock_response

        result = await schema.execute(
            LOGOUT_MUTATION,
            context_value=context,
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["logout"]["success"] is True
        assert mock_response.delete_cookie.call_count == 5
        expected_cookies = [
            "microsoft-refresh-token",
            "guest-token",
            "github-refresh-token",
            "google-refresh-token",
            "token",
        ]
        for call, expected_cookie in zip(
            mock_response.delete_cookie.call_args_list,
            expected_cookies,
            strict=True,
        ):
            kwargs = call.kwargs
            assert kwargs.get("key") == expected_cookie
            assert kwargs.get("httponly") is True
            assert kwargs.get("secure") is True
