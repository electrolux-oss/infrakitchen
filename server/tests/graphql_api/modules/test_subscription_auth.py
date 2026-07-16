from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest
from core.errors import AccessUnauthorized

from graphql_api.modules.log.subscriptions import _authenticate_subscription


@pytest.mark.asyncio
async def test_authenticate_subscription_uses_shared_token_resolution(mock_user_dto):
    service = SimpleNamespace()
    request = SimpleNamespace(state=SimpleNamespace())
    info: Any = SimpleNamespace(
        context={
            "connection_params": {"token": "ik_test_personal_access_token"},
            "sso_service": service,
            "request": request,
        }
    )

    get_user_from_token = AsyncMock(return_value=mock_user_dto)
    from graphql_api.modules.log import subscriptions as subscriptions_module

    subscriptions_module.get_user_from_token = get_user_from_token

    user = await _authenticate_subscription(info)

    assert user == mock_user_dto
    assert info.context["user"] == mock_user_dto
    assert request.state.user == mock_user_dto
    get_user_from_token.assert_awaited_once_with(service, "ik_test_personal_access_token")


@pytest.mark.asyncio
async def test_authenticate_subscription_rejects_invalid_shared_token(monkeypatch):
    service = SimpleNamespace()
    info: Any = SimpleNamespace(
        context={
            "connection_params": {"token": "ik_invalid_personal_access_token"},
            "sso_service": service,
        }
    )

    monkeypatch.setattr(
        "graphql_api.modules.log.subscriptions.get_user_from_token",
        AsyncMock(side_effect=AccessUnauthorized("Invalid authentication credentials")),
    )

    with pytest.raises(PermissionError, match="Invalid authentication token"):
        await _authenticate_subscription(info)
