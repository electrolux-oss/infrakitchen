"""Tests for PAT scopes: validation, subset enforcement, and clamping."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from core.errors import AccessDenied

from core.personal_access_tokens.scopes import (
    get_current_token_scopes,
    scope_allows,
    set_current_token_scopes,
)
from core.personal_access_tokens.schema import PersonalAccessTokenCreate


# --- scope_allows semantics ---


def test_unscoped_token_allows_everything():
    assert scope_allows(None, "read", "resource") is True
    assert scope_allows(None, "write", "template") is True
    assert scope_allows(None, "admin", "anything") is True


def test_scoped_token_never_grants_admin():
    scopes = {"write:resource", "read:template"}
    # Even "admin:something" in the set can't grant admin: it's not a valid
    # stored scope, but the guard makes the intent explicit.
    assert scope_allows(scopes, "admin", "resource") is False
    assert scope_allows({"admin:resource"}, "admin", "resource") is False


def test_scoped_token_matching_scope():
    assert scope_allows({"read:resource"}, "read", "resource") is True
    assert scope_allows({"write:resource"}, "write", "resource") is True


def test_scoped_token_write_implies_read():
    assert scope_allows({"write:resource"}, "read", "resource") is True
    # ...but not the other way around.
    assert scope_allows({"read:resource"}, "write", "resource") is False


def test_scoped_token_other_entity_denied():
    assert scope_allows({"read:resource"}, "read", "template") is False


# --- create-time validation ---


def test_scoped_token_allows_no_expiry():
    """Scopes do not force an expiry; unscoped tokens never do either."""
    body = PersonalAccessTokenCreate(name="dev", scopes=["read:resource"], expires_at=None)
    assert body.scopes == ["read:resource"]
    assert body.expires_at is None

    unscoped = PersonalAccessTokenCreate(name="dev", scopes=None, expires_at=None)
    assert unscoped.scopes is None


def test_token_future_expiry_required_and_normalized():
    tz = datetime.now(UTC) + timedelta(days=7)
    body = PersonalAccessTokenCreate(name="t", scopes=None, expires_at=tz)
    assert body.expires_at is not None and body.expires_at.tzinfo is UTC

    with pytest.raises(ValueError, match="must be in the future"):
        PersonalAccessTokenCreate(name="t", expires_at=datetime.now(UTC) - timedelta(days=1))


def test_scoped_token_valid_format():
    body = PersonalAccessTokenCreate(
        name="agent",
        scopes=["read:resource", "write:template"],
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    assert body.scopes == ["read:resource", "write:template"]


def test_scoped_token_rejects_admin_and_garbage():
    with pytest.raises(ValueError, match="Invalid scope"):
        PersonalAccessTokenCreate(
            name="agent",
            scopes=["admin:resource"],
            expires_at=datetime.now(UTC) + timedelta(days=7),
        )
    with pytest.raises(ValueError, match="Invalid scope"):
        PersonalAccessTokenCreate(
            name="agent",
            scopes=["host:*"],
            expires_at=datetime.now(UTC) + timedelta(days=7),
        )


def test_unscoped_token_allows_no_expiry():
    body = PersonalAccessTokenCreate(name="dev token", scopes=None, expires_at=None)
    assert body.scopes is None


# --- subset-of-owner enforcement in the service ---


@pytest.mark.asyncio
async def test_create_token_rejects_scope_beyond_owner():
    from core.personal_access_tokens.service import PersonalAccessTokenService

    service = PersonalAccessTokenService(crud=MagicMock())
    requester = MagicMock(id="user-1")
    body = MagicMock(name="agent", scopes=["write:resource"], expires_at="2027-01-01")

    with patch(
        "core.personal_access_tokens.service.user_apis_permissions",
        AsyncMock(return_value={"api:resource": "read", "api:template": "read"}),
    ):
        with pytest.raises(ValueError, match="exceeds the creator's own permissions"):
            await service.create_token("user-1", body, requester)


@pytest.mark.asyncio
async def test_create_token_accepts_scope_within_owner():
    from datetime import UTC, datetime, timedelta

    from core.personal_access_tokens.service import PersonalAccessTokenService

    fake_created = SimpleNamespace(
        id="t",
        user_id="user-1",
        name="agent",
        scopes=["read:resource"],
        token_hash="h",
        token_prefix="ik_abc",
        expires_at=datetime.now(UTC) + timedelta(days=7),
        last_used_at=None,
        revoked_at=None,
        created_at=datetime.now(UTC),
    )
    crud = MagicMock(
        create=AsyncMock(return_value=fake_created),
        refresh=AsyncMock(),
    )
    service = PersonalAccessTokenService(crud=crud)
    requester = MagicMock(id="user-1")
    body = MagicMock(
        name="agent",
        scopes=["read:resource"],
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )

    with (
        patch(
            "core.personal_access_tokens.service.user_apis_permissions",
            AsyncMock(return_value={"api:resource": "read"}),
        ),
        patch("core.personal_access_tokens.service.PersonalAccessTokenResponse") as resp_cls,
    ):
        resp_cls.model_validate.return_value.model_dump.return_value = {}
        with patch("core.personal_access_tokens.service.PersonalAccessTokenCreateResponse") as create_resp_cls:
            create_resp_cls.return_value = "sentinel"
            result = await service.create_token("user-1", body, requester)
            assert result == "sentinel"
            crud.create.assert_awaited_once()
            passed_body = crud.create.await_args.args[0]
            assert passed_body["scopes"] == ["read:resource"]


@pytest.mark.asyncio
async def test_create_token_allows_scope_for_super_admin_owner():
    """A super admin owner has "*": "admin"; any valid scope is within their reach."""
    from datetime import UTC, datetime, timedelta

    from core.personal_access_tokens.service import PersonalAccessTokenService

    fake_created = SimpleNamespace(
        id="t",
        user_id="user-1",
        name="agent",
        scopes=["write:whatever"],
        token_hash="h",
        token_prefix="ik_abc",
        expires_at=datetime.now(UTC) + timedelta(days=7),
        last_used_at=None,
        revoked_at=None,
        created_at=datetime.now(UTC),
    )
    crud = MagicMock(
        create=AsyncMock(return_value=fake_created),
        refresh=AsyncMock(),
    )
    service = PersonalAccessTokenService(crud=crud)
    requester = MagicMock(id="user-1")
    body = MagicMock(
        name="agent",
        scopes=["write:whatever"],
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )

    with (
        patch(
            "core.personal_access_tokens.service.user_apis_permissions",
            AsyncMock(return_value={"*": "admin"}),
        ),
        patch("core.personal_access_tokens.service.PersonalAccessTokenResponse") as resp_cls,
        patch("core.personal_access_tokens.service.PersonalAccessTokenCreateResponse") as create_resp_cls,
    ):
        resp_cls.model_validate.return_value.model_dump.return_value = {}
        create_resp_cls.return_value = "sentinel"
        result = await service.create_token("user-1", body, requester)
        assert result == "sentinel"


# --- check_api_permission clamping ---


@pytest.mark.asyncio
async def test_check_api_permission_clamps_scoped_token(monkeypatch):
    """The scope clamp runs before Casbin: a scoped token requesting a policy
    outside its grants is denied with the scope message, even when the owner's
    own Casbin permissions would allow it."""
    from graphql_api.helpers import check_api_permission

    info: Any = SimpleNamespace(context={"user": SimpleNamespace(deactivated=False, id="user-1", primary_account=None)})
    monkeypatch.setattr(
        "graphql_api.helpers.get_current_token_scopes",
        lambda: {"read:resource"},
    )

    # Casbin must NOT be consulted for the denied path (it would grant).
    def _fail_enforcer():
        raise AssertionError("Casbin enforcer must not be reached when the scope clamp denies")

    monkeypatch.setattr("graphql_api.helpers.CasbinEnforcer", _fail_enforcer)

    with pytest.raises(AccessDenied, match="granted scopes do not allow"):
        await check_api_permission(info, "resource", ["write"])

    # Admin is never granted via a scoped token either.
    with pytest.raises(AccessDenied, match="granted scopes do not allow"):
        await check_api_permission(info, "resource", ["admin"])


def test_contextvar_roundtrip():
    assert get_current_token_scopes() is None
    set_current_token_scopes(["read:resource"])
    assert get_current_token_scopes() == {"read:resource"}
    set_current_token_scopes(None)
    assert get_current_token_scopes() is None
