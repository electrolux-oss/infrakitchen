"""Tests for the MCP auth middleware in server.py."""

from typing import Any

import pytest
import httpx

from infrakitchen_mcp.server import _auth_middleware_factory, AUTH_PROBE_PATH


def _make_middleware(probe_status: int = 200, probe_error: bool = False):
    """Build the middleware dispatch function with a mock loopback client."""

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        if probe_error:
            raise ConnectionError("auth service down")
        if request.url.path == AUTH_PROBE_PATH:
            return httpx.Response(probe_status, json={"id": "user-1"})
        return httpx.Response(200, json={"ok": True})

    transport = httpx.MockTransport(mock_handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://internal")
    return _auth_middleware_factory(client)


def _fake_request(headers: dict[str, str] | None = None) -> Any:
    """Build a minimal request-like object for testing middleware."""

    class _Req:
        def __init__(self, h: dict[str, str]) -> None:
            self.headers = h

    return _Req(headers or {})


class _FakeResponse:
    status_code = 200


@pytest.mark.asyncio
async def test_missing_auth_header_returns_401():
    dispatch = _make_middleware()
    request = _fake_request()
    response = await dispatch(request, call_next=lambda r: _FakeResponse())
    assert response.status_code == 401
    assert b"Missing Authorization" in response.body


@pytest.mark.asyncio
async def test_invalid_token_returns_401():
    dispatch = _make_middleware(probe_status=401)
    request = _fake_request(headers={"Authorization": "Bearer bad-token"})
    response = await dispatch(request, call_next=lambda r: _FakeResponse())
    assert response.status_code == 401
    assert b"Invalid or expired" in response.body


@pytest.mark.asyncio
async def test_forbidden_token_returns_401():
    dispatch = _make_middleware(probe_status=403)
    request = _fake_request(headers={"Authorization": "Bearer forbidden-token"})
    response = await dispatch(request, call_next=lambda r: _FakeResponse())
    assert response.status_code == 401
    assert b"Invalid or expired" in response.body


@pytest.mark.asyncio
async def test_probe_server_error_returns_503():
    dispatch = _make_middleware(probe_status=500)
    request = _fake_request(headers={"Authorization": "Bearer valid-token"})
    response = await dispatch(request, call_next=lambda r: _FakeResponse())
    assert response.status_code == 503
    assert b"Auth service error" in response.body


@pytest.mark.asyncio
async def test_probe_connection_error_returns_503():
    dispatch = _make_middleware(probe_error=True)
    request = _fake_request(headers={"Authorization": "Bearer valid-token"})
    response = await dispatch(request, call_next=lambda r: _FakeResponse())
    assert response.status_code == 503
    assert b"Auth service unavailable" in response.body


@pytest.mark.asyncio
async def test_unexpected_probe_status_returns_503():
    """Unexpected status (e.g. 404 if auth endpoint is mis-mounted) should not pass through."""
    dispatch = _make_middleware(probe_status=404)
    request = _fake_request(headers={"Authorization": "Bearer some-token"})
    response = await dispatch(request, call_next=lambda r: _FakeResponse())
    assert response.status_code == 503
    assert b"Auth service error" in response.body


@pytest.mark.asyncio
async def test_redirect_probe_status_returns_503():
    """3xx redirects should not be treated as successful auth."""
    dispatch = _make_middleware(probe_status=302)
    request = _fake_request(headers={"Authorization": "Bearer some-token"})
    response = await dispatch(request, call_next=lambda r: _FakeResponse())
    assert response.status_code == 503
    assert b"Auth service error" in response.body


@pytest.mark.asyncio
async def test_valid_token_passes_through():
    dispatch = _make_middleware(probe_status=200)
    request = _fake_request(headers={"Authorization": "Bearer good-token"})

    call_next_called = False

    async def call_next(req):
        nonlocal call_next_called
        call_next_called = True
        return _FakeResponse()

    response = await dispatch(request, call_next=call_next)
    assert call_next_called
    assert response.status_code == 200
