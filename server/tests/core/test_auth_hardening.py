import importlib
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import jwt
import pytest

from core.config import Settings, validate_jwt_key
from core.errors import AccessUnauthorized
from core.sso import functions as sso_functions
from core.utils.rate_limiter import SlidingWindowLimiter

# core.sso re-exports the module's router under the same name
service_account = importlib.import_module("core.sso.service_account")


@pytest.mark.parametrize("key", ["", "supersecret", "CHANGE_ME", "too-short"])
def test_validate_jwt_key_rejects_known_or_weak_keys(monkeypatch, key):
    monkeypatch.setenv("JWT_KEY", key)

    with pytest.raises(RuntimeError, match="JWT_KEY"):
        validate_jwt_key()


def test_validate_jwt_key_accepts_random_key(monkeypatch):
    monkeypatch.setenv("JWT_KEY", "x" * 32)

    validate_jwt_key()


def test_sliding_window_limiter_blocks_after_max_hits():
    limiter = SlidingWindowLimiter(max_hits=2, window_seconds=60)

    limiter.hit("k")
    assert limiter.is_limited("k") is False
    limiter.hit("k")
    assert limiter.is_limited("k") is True
    assert limiter.is_limited("other") is False

    limiter.reset("k")
    assert limiter.is_limited("k") is False


def test_sliding_window_limiter_bounds_tracked_keys():
    limiter = SlidingWindowLimiter(max_hits=1, window_seconds=60, max_keys=3)

    for key in ("a", "b", "c", "d"):
        limiter.hit(key)

    assert limiter.is_limited("a") is False
    assert limiter.is_limited("d") is True


def _service_account_service(user):
    service = Mock()
    service.auth_provider_service.get_all = AsyncMock(return_value=[SimpleNamespace(enabled=True)])
    service.user_service.get_user_by_identifier = AsyncMock(return_value=user)
    return service


@pytest.fixture
def fresh_limiters(monkeypatch):
    monkeypatch.setattr(service_account, "_attempts_per_client", SlidingWindowLimiter(30, 60))
    monkeypatch.setattr(service_account, "_failures_per_identifier", SlidingWindowLimiter(10, 300))


@pytest.mark.asyncio
async def test_unknown_service_account_still_runs_a_password_check(fresh_limiters):
    service = _service_account_service(None)
    connection = SimpleNamespace(client=SimpleNamespace(host="10.0.0.1"))

    with patch.object(service_account, "burn_password_check", AsyncMock()) as burn:
        with pytest.raises(AccessUnauthorized, match="Invalid password or username"):
            _ = await service_account.authenticate_service_account(service, connection, "nobody", "pw")

    burn.assert_awaited_once_with("pw")


@pytest.mark.asyncio
async def test_service_account_identifier_is_locked_after_repeated_failures(fresh_limiters):
    user = SimpleNamespace(password=Mock())
    user.password.get_decrypted_value.return_value = "salt$hash"
    service = _service_account_service(user)

    with patch.object(service_account, "is_correct_password_async", AsyncMock(return_value=False)):
        for i in range(10):
            connection = SimpleNamespace(client=SimpleNamespace(host=f"10.0.0.{i}"))
            with pytest.raises(AccessUnauthorized, match="Invalid password"):
                _ = await service_account.authenticate_service_account(service, connection, "svc", "bad")

    connection = SimpleNamespace(client=SimpleNamespace(host="10.0.1.1"))
    with patch.object(service_account, "is_correct_password_async", AsyncMock(return_value=True)) as check:
        with pytest.raises(AccessUnauthorized, match="Too many login attempts"):
            _ = await service_account.authenticate_service_account(service, connection, "svc", "good")
    check.assert_not_awaited()


@pytest.mark.asyncio
async def test_service_account_client_is_throttled(fresh_limiters):
    service = _service_account_service(None)
    connection = SimpleNamespace(client=SimpleNamespace(host="10.0.0.1"))

    with patch.object(service_account, "burn_password_check", AsyncMock()):
        for i in range(30):
            with pytest.raises(AccessUnauthorized, match="Invalid password"):
                _ = await service_account.authenticate_service_account(service, connection, f"user{i}", "pw")
        with pytest.raises(AccessUnauthorized, match="Too many login attempts"):
            _ = await service_account.authenticate_service_account(service, connection, "another", "pw")


def _infrakitchen_token(audience: str = "infrakitchen", algorithm: str = "HS256") -> str:
    return jwt.encode(
        {"pld": {"id": "u1"}, "exp": datetime.now(UTC) + timedelta(minutes=5), "aud": audience},
        key=Settings().JWT_KEY,
        algorithm=algorithm,
        headers={"typ": "infrakitchen.auth.token"},
    )


def test_internal_token_audience_is_fixed():
    assert sso_functions.validate_token(_infrakitchen_token())["pld"] == {"id": "u1"}

    with pytest.raises(AccessUnauthorized):
        _ = sso_functions.validate_token(_infrakitchen_token(audience="someone-else"))


def test_internal_token_algorithm_is_fixed():
    with pytest.raises(AccessUnauthorized):
        _ = sso_functions.validate_token(_infrakitchen_token(algorithm="HS512"))


@pytest.mark.asyncio
async def test_jwks_is_cached_and_unknown_kids_do_not_refetch(monkeypatch):
    monkeypatch.setattr(sso_functions, "_jwks_cache", {})
    fetch = AsyncMock(return_value=[{"kid": "k1"}])
    monkeypatch.setattr(sso_functions, "get_jwks", fetch)
    monkeypatch.setattr(sso_functions.ECAlgorithm, "from_jwk", staticmethod(lambda jwk: f"key-{jwk['kid']}"))

    assert await sso_functions.get_jwks_key("https://bs/jwks", "k1") == "key-k1"
    assert await sso_functions.get_jwks_key("https://bs/jwks", "k1") == "key-k1"
    for _ in range(3):
        with pytest.raises(AccessUnauthorized):
            _ = await sso_functions.get_jwks_key("https://bs/jwks", "made-up")

    fetch.assert_awaited_once()
