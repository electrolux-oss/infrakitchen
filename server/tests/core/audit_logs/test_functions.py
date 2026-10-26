"""Tests for permission denial audit logging."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import UUID

from core.audit_logs.functions import audit_permission_denial
from core.personal_access_tokens.scopes import set_current_token_identity


async def test_denial_is_written_with_metadata():
    handler = SimpleNamespace(create_log=AsyncMock())
    fake_session = SimpleNamespace(commit=AsyncMock())

    class _FakeSessionCtx:
        async def __aenter__(self):
            return fake_session

        async def __aexit__(self, *args):
            return False

    with (
        patch(
            "core.audit_logs.functions.get_async_session",
            return_value=_FakeSessionCtx(),
        ),
        patch(
            "core.audit_logs.functions.AuditLogHandler",
            return_value=handler,
        ),
    ):
        set_current_token_identity("ik_abc12345", "agent")
        try:
            await audit_permission_denial(
                None,
                "user-1",
                entity_name="templates",
                policies=["read"],
                limited_by="token_scopes",
            )
        finally:
            set_current_token_identity(None, None)

    entity_id, user_id, action = handler.create_log.await_args.args
    assert entity_id == UUID(int=0)
    assert user_id == "user-1"
    # The event is the attempted operation, not the denial itself.
    assert action == "read"
    kwargs = handler.create_log.await_args.kwargs
    assert kwargs["action_metadata"]["entity"] == "templates"
    assert kwargs["action_metadata"]["policies"] == "read"
    assert kwargs["action_metadata"]["denied"] == "true"
    assert kwargs["action_metadata"]["limited_by"] == "token_scopes"
    assert kwargs["action_metadata"]["token_prefix"] == "ik_abc12345"
    assert kwargs["action_metadata"]["token_name"] == "agent"
    fake_session.commit.assert_awaited_once()


async def test_denial_auditing_failure_is_swallowed():
    handler = SimpleNamespace(create_log=AsyncMock(side_effect=Exception("db down")))

    class _BrokenCtx:
        async def __aenter__(self):
            return SimpleNamespace()

        async def __aexit__(self, *args):
            return False

    with (
        patch(
            "core.audit_logs.functions.get_async_session",
            return_value=_BrokenCtx(),
        ),
        patch(
            "core.audit_logs.functions.AuditLogHandler",
            return_value=handler,
        ),
    ):
        # Must not raise — denial handling must never be blocked by audit.
        await audit_permission_denial(
            None,
            "user-1",
            entity_name="templates",
            policies=["read"],
            limited_by="token_scopes",
        )
