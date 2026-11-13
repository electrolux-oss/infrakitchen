from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest

from core.errors import AccessDenied
from graphql_api.modules.log import permissions
from graphql_api.modules.log.permissions import (
    check_log_entity_access,
    log_entities_allowed,
    restrict_log_filter,
)

INFO: Any = SimpleNamespace(context={"user": SimpleNamespace(id="user-1")})


@pytest.fixture
def user_check(monkeypatch):
    check = AsyncMock()
    monkeypatch.setattr(permissions, "check_user_api_permission", check)
    monkeypatch.setattr(permissions, "audit_permission_denial", AsyncMock())
    return check


def _scopes(monkeypatch, scopes: set[str] | None):
    monkeypatch.setattr(permissions, "get_current_token_scopes", lambda: scopes)


@pytest.mark.asyncio
async def test_unscoped_token_reads_all_logs(monkeypatch, user_check):
    _scopes(monkeypatch, None)
    assert await log_entities_allowed(INFO) is None
    user_check.assert_awaited_once_with(INFO, "log", ["read"])


@pytest.mark.asyncio
async def test_entity_scopes_limit_logs_to_those_entities(monkeypatch, user_check):
    _scopes(monkeypatch, {"read:resource", "write:workflow"})
    assert await log_entities_allowed(INFO) == {"resource", "workflow"}
    user_check.assert_awaited_once_with(INFO, "log", ["read"])


@pytest.mark.asyncio
async def test_log_stream_denied_for_entity_outside_scopes(monkeypatch, user_check):
    _scopes(monkeypatch, {"read:resource"})
    await check_log_entity_access(INFO, "resource")
    with pytest.raises(AccessDenied):
        await check_log_entity_access(INFO, "executor")


def test_restrict_log_filter():
    assert restrict_log_filter({"entity_id": "x"}, None) == {"entity_id": "x"}
    assert restrict_log_filter(None, {"resource"}) == {"entity__in": ["resource"]}
    restricted = restrict_log_filter({"entity_id": "x"}, {"workflow", "resource"})
    assert restricted is not None
    assert set(restricted["entity__in"]) == {"resource", "workflow"}
    assert restricted["or"] == [{"entity_id": "x"}]
