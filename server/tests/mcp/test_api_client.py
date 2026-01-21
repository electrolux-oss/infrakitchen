from infrakitchen_mcp.client import InternalAPIClient
from infrakitchen_mcp.context import request_auth_token
from infrakitchen_mcp.server import _auth_middleware_dispatch
import pytest
from unittest.mock import MagicMock


class TestAPIClientBasics:
    """Test basic API client functionality."""

    @pytest.mark.asyncio
    async def test_successful_get(self, fastapi_app):
        """Should successfully fetch and parse JSON response."""
        client = InternalAPIClient(fastapi_app)

        token = request_auth_token.set("Bearer test")
        try:
            result = await client.get("workspaces/ws-123")
            assert result["id"] == "ws-123"
        finally:
            request_auth_token.reset(token)

    @pytest.mark.asyncio
    async def test_404_returns_error_dict(self, fastapi_app):
        """Should return structured error for 404."""
        client = InternalAPIClient(fastapi_app)
        result = await client.get("nonexistent/endpoint")

        assert result["error"] == "not_found"
        assert "path" in result

    @pytest.mark.asyncio
    async def test_filters_none_params(self, fastapi_app):
        """None parameters should be filtered out, not sent."""
        client = InternalAPIClient(fastapi_app)

        token = request_auth_token.set("Bearer test")
        try:
            result = await client.get("workspaces", filter=None, range=None)
            assert isinstance(result, list)
        finally:
            request_auth_token.reset(token)


class TestAuthPropagation:
    """Test that auth tokens are properly forwarded through client."""

    @pytest.mark.asyncio
    async def test_auth_header_forwarded(self, fastapi_app):
        """Auth token from context should be sent in request headers."""
        client = InternalAPIClient(fastapi_app)

        token = request_auth_token.set("Bearer my-secret-token")
        try:
            result = await client.get("auth-check")

            assert result["has_auth"] is True
            assert result["auth_value"] == "Bearer my-secret-token"
        finally:
            request_auth_token.reset(token)

    @pytest.mark.asyncio
    async def test_no_auth_when_not_set(self, fastapi_app):
        """Should not send auth header when context is empty."""
        client = InternalAPIClient(fastapi_app)

        assert request_auth_token.get() is None

        result = await client.get("auth-check")

        assert result["has_auth"] is False
        assert result["auth_value"] is None

    @pytest.mark.asyncio
    async def test_auth_required_endpoint_fails_without_token(self, fastapi_app):
        """Protected endpoint should return error without auth."""
        client = InternalAPIClient(fastapi_app)

        result = await client.get("workspaces")

        assert result["error"] == 401

    @pytest.mark.asyncio
    async def test_auth_required_endpoint_succeeds_with_token(self, fastapi_app):
        """Protected endpoint should work with auth token."""
        client = InternalAPIClient(fastapi_app)

        token = request_auth_token.set("Bearer valid-token")
        try:
            result = await client.get("workspaces")

            assert isinstance(result, list)
            assert result[0]["id"] == "ws-1"
        finally:
            request_auth_token.reset(token)

    @pytest.mark.asyncio
    async def test_token_isolation_between_requests(self, fastapi_app):
        """Token should not leak between contexts."""
        client = InternalAPIClient(fastapi_app)

        token = request_auth_token.set("Bearer first-token")
        result1 = await client.get("auth-check")
        request_auth_token.reset(token)

        result2 = await client.get("auth-check")

        assert result1["auth_value"] == "Bearer first-token"
        assert result2["auth_value"] is None


class TestAuthMiddleware:
    """Test middleware token extraction and cleanup."""

    @pytest.mark.asyncio
    async def test_extracts_auth_header(self):
        """Should extract Authorization header into context."""
        request = MagicMock()
        request.headers = {"Authorization": "Bearer extracted-token"}

        captured_token = None

        async def capture_next(req):
            nonlocal captured_token
            captured_token = request_auth_token.get()
            return MagicMock()

        await _auth_middleware_dispatch(request, capture_next)

        assert captured_token == "Bearer extracted-token"

    @pytest.mark.asyncio
    async def test_handles_missing_header(self):
        """Should handle requests without Authorization header."""
        request = MagicMock()
        request.headers = {}

        captured_token = "should-be-replaced"

        async def capture_next(req):
            nonlocal captured_token
            captured_token = request_auth_token.get()
            return MagicMock()

        await _auth_middleware_dispatch(request, capture_next)

        assert captured_token is None

    @pytest.mark.asyncio
    async def test_resets_on_exception(self):
        """Token should be reset even if handler raises."""
        request = MagicMock()
        request.headers = {"Authorization": "Bearer temp"}

        async def failing_next(req):
            raise ValueError("Handler failed")

        with pytest.raises(ValueError):
            await _auth_middleware_dispatch(request, failing_next)

        assert request_auth_token.get() is None
