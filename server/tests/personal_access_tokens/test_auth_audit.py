"""Tests for personal access token authentication audit logging.

``get_valid_token`` must record a ``login`` audit log entry whenever a token
row exists and the attempt can be attributed to the token owner — failures
marked by a ``reason`` in the metadata, success without one — and must never
let an auditing failure block authentication.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, patch

from core.personal_access_tokens.service import _audit_token_authentication, PersonalAccessTokenService
from core.request_context import set_current_user_agent


# A well-formed raw token ("ik_<32hex>_<secret>") so the id lookup parses; the
# secret part is irrelevant, the test mocks the password check.
RAW_TOKEN = f"ik_{'1' * 32}_secret"


def _make_token(**overrides):
    token = SimpleNamespace(
        id="11111111-1111-1111-1111-111111111111",
        user_id="user-1",
        name="t",
        token_hash="h",
        token_prefix="ik_abc12345",
        scopes=None,
        expires_at=None,
        last_used_at=None,
        revoked_at=None,
    )
    for key, value in overrides.items():
        setattr(token, key, value)
    return token


def _make_service(token):
    crud = SimpleNamespace(
        get_by_id=AsyncMock(return_value=token),
        update=AsyncMock(),
    )
    return PersonalAccessTokenService(crud=crud)


async def test_audit_metadata_carries_token_identity_and_reason():
    """The metadata is what lets the UI flag a row as token authentication."""
    handler = SimpleNamespace(create_log=AsyncMock())
    fake_session = SimpleNamespace(commit=AsyncMock())

    class _FakeSessionCtx:
        async def __aenter__(self):
            return fake_session

        async def __aexit__(self, *args):
            return False

    with (
        patch(
            "core.personal_access_tokens.service.get_async_session",
            return_value=_FakeSessionCtx(),
        ),
        patch(
            "core.personal_access_tokens.service.AuditLogHandler",
            return_value=handler,
        ),
    ):
        await _audit_token_authentication(
            "tid",
            "uid",
            reason="expired",
            token_prefix="ik_abc12345",
            token_name="agent",
        )

    handler.create_log.assert_awaited_once_with(
        "tid",
        "uid",
        "login",
        action_metadata={"reason": "expired", "token_prefix": "ik_abc12345", "token_name": "agent"},
    )
    fake_session.commit.assert_awaited_once()


async def test_audit_metadata_success_has_no_reason():
    """Successful logins carry the token identity but no ``reason`` key."""
    handler = SimpleNamespace(create_log=AsyncMock())
    fake_session = SimpleNamespace(commit=AsyncMock())

    class _FakeSessionCtx:
        async def __aenter__(self):
            return fake_session

        async def __aexit__(self, *args):
            return False

    with (
        patch(
            "core.personal_access_tokens.service.get_async_session",
            return_value=_FakeSessionCtx(),
        ),
        patch(
            "core.personal_access_tokens.service.AuditLogHandler",
            return_value=handler,
        ),
    ):
        await _audit_token_authentication(
            "tid",
            "uid",
            token_prefix="ik_abc12345",
            token_name="agent",
        )

    handler.create_log.assert_awaited_once_with(
        "tid",
        "uid",
        "login",
        action_metadata={"token_prefix": "ik_abc12345", "token_name": "agent"},
    )


async def test_successful_authentication_is_audited():
    token = _make_token()
    service = _make_service(token)

    with (
        patch("core.personal_access_tokens.service.is_correct_password", return_value=True),
        patch(
            # Avoids real hashing and a real DTO: EncryptedSecretStr needs an
            # ENCRYPTION_KEY and pydantic would reserialize the hash.
            "core.personal_access_tokens.service.EncryptedSecretStr"
        ) as encrypted_cls,
        patch("core.personal_access_tokens.service.PersonalAccessTokenDTO") as dto_cls,
        patch("core.personal_access_tokens.service._audit_token_authentication") as audit,
    ):
        encrypted_cls.return_value.get_decrypted_value.return_value = "salt$hash"
        dto_cls.model_validate.return_value = "sentinel-dto"

        result = await service.get_valid_token(RAW_TOKEN)

    assert result == "sentinel-dto"
    audit.assert_awaited_once_with(
        token.id,
        token.user_id,
        token_prefix=token.token_prefix,
        token_name=token.name,
    )
    service.crud.update.assert_awaited_once_with(token, {"last_used_at": ANY})


async def test_expired_token_is_audited_as_failure():
    token = _make_token(expires_at=datetime.now(UTC) - timedelta(days=1))
    service = _make_service(token)

    with (
        patch("core.personal_access_tokens.service.is_correct_password", return_value=True),
        patch("core.personal_access_tokens.service._audit_token_authentication") as audit,
    ):
        result = await service.get_valid_token(RAW_TOKEN)

    assert result is None
    audit.assert_awaited_once_with(
        token.id,
        token.user_id,
        reason="expired",
        token_prefix=token.token_prefix,
        token_name=token.name,
    )
    # last_used_at must not move on rejected attempts.
    service.crud.update.assert_not_awaited()


async def test_revoked_token_is_audited_as_failure():
    token = _make_token(revoked_at=datetime.now(UTC) - timedelta(days=1))
    service = _make_service(token)

    with patch("core.personal_access_tokens.service._audit_token_authentication") as audit:
        result = await service.get_valid_token(RAW_TOKEN)

    assert result is None
    audit.assert_awaited_once_with(
        token.id,
        token.user_id,
        reason="revoked",
        token_prefix=token.token_prefix,
        token_name=token.name,
    )
    service.crud.update.assert_not_awaited()


async def test_wrong_secret_is_audited_as_failure():
    token = _make_token()
    service = _make_service(token)

    with (
        patch("core.personal_access_tokens.service.is_correct_password", return_value=False),
        patch("core.personal_access_tokens.service.EncryptedSecretStr") as encrypted_cls,
        patch("core.personal_access_tokens.service._audit_token_authentication") as audit,
    ):
        encrypted_cls.return_value.get_decrypted_value.return_value = "salt$hash"

        result = await service.get_valid_token(RAW_TOKEN)

    assert result is None
    audit.assert_awaited_once_with(
        token.id,
        token.user_id,
        reason="invalid_credentials",
        token_prefix=token.token_prefix,
        token_name=token.name,
    )
    service.crud.update.assert_not_awaited()


async def test_audit_metadata_includes_request_user_agent():
    """The captured request User-Agent lands in the audit metadata."""
    handler = SimpleNamespace(create_log=AsyncMock())
    fake_session = SimpleNamespace(commit=AsyncMock())

    class _FakeSessionCtx:
        async def __aenter__(self):
            return fake_session

        async def __aexit__(self, *args):
            return False

    with (
        patch(
            "core.personal_access_tokens.service.get_async_session",
            return_value=_FakeSessionCtx(),
        ),
        patch(
            "core.personal_access_tokens.service.AuditLogHandler",
            return_value=handler,
        ),
    ):
        set_current_user_agent("curl/8.4.0")
        try:
            await _audit_token_authentication(
                "tid",
                "uid",
                token_prefix="ik_abc12345",
                token_name="agent",
            )
        finally:
            set_current_user_agent(None)

    handler.create_log.assert_awaited_once_with(
        "tid",
        "uid",
        "login",
        action_metadata={
            "token_prefix": "ik_abc12345",
            "token_name": "agent",
            "user_agent": "curl/8.4.0",
        },
    )


async def test_audit_metadata_omits_user_agent_when_absent():
    """No captured UA (background jobs, missing header): no metadata key."""
    handler = SimpleNamespace(create_log=AsyncMock())
    fake_session = SimpleNamespace(commit=AsyncMock())

    class _FakeSessionCtx:
        async def __aenter__(self):
            return fake_session

        async def __aexit__(self, *args):
            return False

    with (
        patch(
            "core.personal_access_tokens.service.get_async_session",
            return_value=_FakeSessionCtx(),
        ),
        patch(
            "core.personal_access_tokens.service.AuditLogHandler",
            return_value=handler,
        ),
    ):
        await _audit_token_authentication(
            "tid",
            "uid",
            token_prefix="ik_abc12345",
            token_name="agent",
        )

    handler.create_log.assert_awaited_once_with(
        "tid",
        "uid",
        "login",
        action_metadata={"token_prefix": "ik_abc12345", "token_name": "agent"},
    )


async def test_unknown_token_is_not_audited():
    """No token row: the attempt cannot be attributed to a user, so no audit."""
    crud = SimpleNamespace(get_by_id=AsyncMock(return_value=None), update=AsyncMock())
    service = PersonalAccessTokenService(crud=crud)

    with patch("core.personal_access_tokens.service._audit_token_authentication") as audit:
        result = await service.get_valid_token(RAW_TOKEN)

    assert result is None
    audit.assert_not_awaited()
    service.crud.update.assert_not_awaited()


async def test_auditing_failure_does_not_break_authentication():
    """Audit errors are swallowed (logged as warnings), auth still succeeds."""
    token = _make_token()
    service = _make_service(token)

    with (
        patch("core.personal_access_tokens.service.is_correct_password", return_value=True),
        patch("core.personal_access_tokens.service.EncryptedSecretStr") as encrypted_cls,
        patch("core.personal_access_tokens.service.PersonalAccessTokenDTO") as dto_cls,
        patch(
            # Testing the real _audit_token_authentication guard: the log writer
            # blowing up must not break authentication.
            "core.personal_access_tokens.service.AuditLogHandler",
            side_effect=Exception("audit down"),
        ),
    ):
        encrypted_cls.return_value.get_decrypted_value.return_value = "salt$hash"
        dto_cls.model_validate.return_value = "sentinel-dto"

        result = await service.get_valid_token(RAW_TOKEN)

    assert result == "sentinel-dto"
