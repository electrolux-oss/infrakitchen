from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest
from core.errors import AccessDenied, AccessUnauthorized

from graphql_api.modules.log.subscriptions import _authenticate_subscription
from graphql_api.schema import schema


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


class _FakeHub:
    def __init__(self, messages: list[dict[str, Any]]):
        self.messages = messages
        self.topics: list[str] = []

    @asynccontextmanager
    async def subscribe(self, topic: str):
        self.topics.append(topic)

        async def _iterate():
            for message in self.messages:
                yield message

        yield _iterate()


async def _collect(subscription: Any) -> list[Any]:
    return [item async for item in subscription]


@pytest.mark.asyncio
async def test_event_stream_forwards_only_readable_entities_and_masks_secrets(monkeypatch, mock_user_dto):
    from graphql_api.modules.event import subscriptions as event_module

    hub = _FakeHub(
        [
            {"id": "r1", "_entity_name": "resource", "token": "EncryptedSecretStr:abc", "_metadata": {"event": "u"}},
            {"id": "s1", "_entity_name": "secret", "_metadata": {"event": "u"}},
            {"_metadata": {"event": "reload_policies"}},
        ]
    )
    monkeypatch.setattr(event_module.pubsub, "hub", hub)
    monkeypatch.setattr(event_module, "_authenticate_subscription", AsyncMock(return_value=mock_user_dto))

    async def _has_access(user, api, action):
        return api == "resource"

    monkeypatch.setattr(event_module, "user_has_access_to_api", _has_access)

    result = await schema.subscribe(
        "subscription { eventStream { entityId entityName payload } }",
        context_value={"user": None},
    )
    messages = await _collect(result)

    assert [m.data["eventStream"]["entityId"] for m in messages] == ["r1"]
    assert messages[0].data["eventStream"]["payload"]["token"] == "********"


@pytest.mark.asyncio
async def test_event_stream_maps_integration_validation_events(monkeypatch, mock_user_dto):
    from graphql_api.modules.event import subscriptions as event_module

    checked: list[str] = []

    async def _has_access(user, api, action):
        checked.append(api)
        return True

    monkeypatch.setattr(event_module, "user_has_access_to_api", _has_access)

    assert await event_module._can_read(mock_user_dto, "integration_validation_response") is True
    assert checked == ["integration"]


@pytest.mark.asyncio
async def test_event_stream_respects_agent_token_scopes(monkeypatch, mock_user_dto):
    from graphql_api.modules.event import subscriptions as event_module

    monkeypatch.setattr(event_module, "user_has_access_to_api", AsyncMock(return_value=True))
    monkeypatch.setattr(event_module, "get_current_token_scopes", lambda: {"read:template"})

    assert await event_module._can_read(mock_user_dto, "template") is True
    assert await event_module._can_read(mock_user_dto, "resource") is False


@pytest.mark.asyncio
async def test_log_stream_requires_log_read_permission(monkeypatch, mock_user_dto):
    from graphql_api.modules.log import subscriptions as log_module

    hub = _FakeHub([{"lines": [{"data": "secret output"}]}])
    monkeypatch.setattr(log_module.pubsub, "hub", hub)
    monkeypatch.setattr(log_module, "_authenticate_subscription", AsyncMock(return_value=mock_user_dto))
    monkeypatch.setattr(log_module, "check_api_permission", AsyncMock(side_effect=AccessDenied("Access denied")))

    result = await schema.subscribe(
        'subscription { logStream(entityName: "resource", entityId: "r1") { data } }',
        context_value={"user": None},
    )
    messages = await _collect(result)

    assert messages and messages[0].errors
    assert hub.topics == []
