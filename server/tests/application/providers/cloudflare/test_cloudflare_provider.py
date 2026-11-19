from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from pydantic import ValidationError

from application.integrations.schema import CloudflareIntegrationConfig
from application.providers.cloudflare.cloudflare_client import CloudflareClient
from application.providers.cloudflare.cloudflare_provider import CloudflareProvider
from core.adapters.provider_adapters import IntegrationProvider
from core.errors import AccessUnauthorized, CloudWrongCredentials

ACCOUNT_ID = "0123456789abcdef0123456789abcdef"


def test_cloudflare_provider_is_registered():
    assert IntegrationProvider.adapters["cloudflare"] is CloudflareProvider
    assert CloudflareProvider.__integration_provider_type__ == "cloud"


def test_cloudflare_config_account_id_validation():
    assert CloudflareIntegrationConfig.model_validate({"cloudflare_api_token": "t"}).cloudflare_account_id is None
    assert (
        CloudflareIntegrationConfig.model_validate(
            {"cloudflare_api_token": "t", "cloudflare_account_id": ""}
        ).cloudflare_account_id
        is None
    )
    assert (
        CloudflareIntegrationConfig.model_validate(
            {"cloudflare_api_token": "t", "cloudflare_account_id": f" {ACCOUNT_ID.upper()} "}
        ).cloudflare_account_id
        == ACCOUNT_ID
    )
    with pytest.raises(ValidationError):
        CloudflareIntegrationConfig.model_validate({"cloudflare_api_token": "t", "cloudflare_account_id": "nope"})


@pytest.mark.asyncio
async def test_cloudflare_authenticate_sets_environment():
    provider = CloudflareProvider(
        configuration={"cloudflare_api_token": "test_token", "cloudflare_account_id": ACCOUNT_ID}
    )
    await provider.authenticate()
    assert provider.environment_variables["CLOUDFLARE_API_TOKEN"] == "test_token"
    assert provider.environment_variables["CLOUDFLARE_ACCOUNT_ID"] == ACCOUNT_ID
    assert provider.environment_variables["TF_VAR_cloudflare_account_id"] == ACCOUNT_ID


@pytest.mark.asyncio
async def test_cloudflare_authenticate_without_account_id():
    provider = CloudflareProvider(configuration={"cloudflare_api_token": "test_token"}, environment_variables={})
    await provider.authenticate()
    assert provider.environment_variables == {"CLOUDFLARE_API_TOKEN": "test_token"}


@pytest.mark.asyncio
async def test_cloudflare_provider_is_valid_success():
    mock_client = AsyncMock()
    mock_client.verify_token.return_value = {"id": "abc", "status": "active"}

    with patch("application.providers.cloudflare.cloudflare_provider.CloudflareClient", return_value=mock_client):
        provider = CloudflareProvider(configuration={"cloudflare_api_token": "test_token"})
        await provider.authenticate()
        assert await provider.is_valid() is True
    mock_client.verify_token.assert_awaited_once_with(account_id=None)


@pytest.mark.asyncio
async def test_cloudflare_provider_is_valid_inactive_token():
    mock_client = AsyncMock()
    mock_client.verify_token.return_value = {"id": "abc", "status": "disabled"}

    with patch("application.providers.cloudflare.cloudflare_provider.CloudflareClient", return_value=mock_client):
        provider = CloudflareProvider(configuration={"cloudflare_api_token": "test_token"})
        await provider.authenticate()
        with pytest.raises(CloudWrongCredentials, match="not active"):
            await provider.is_valid()


@pytest.mark.asyncio
async def test_cloudflare_provider_is_valid_failure():
    mock_client = AsyncMock()
    mock_client.verify_token.side_effect = AccessUnauthorized("Invalid API Token")

    with patch("application.providers.cloudflare.cloudflare_provider.CloudflareClient", return_value=mock_client):
        provider = CloudflareProvider(configuration={"cloudflare_api_token": "test_token"})
        await provider.authenticate()
        with pytest.raises(CloudWrongCredentials) as exc_info:
            await provider.is_valid()
        assert str(exc_info.value) == "Cloudflare credentials are invalid."


def _transport(responses: dict[str, httpx.Response], calls: list[str]) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        assert request.headers["Authorization"] == "Bearer test_token"
        return responses[request.url.path]

    return httpx.MockTransport(handler)


async def _verify_with(
    responses: dict[str, httpx.Response], account_id: str | None
) -> tuple[dict[str, Any], list[str]]:
    calls: list[str] = []
    transport = _transport(responses, calls)
    original = httpx.AsyncClient

    def client_factory(*args, **kwargs):
        return original(*args, transport=transport, **kwargs)

    with patch("application.providers.cloudflare.cloudflare_client.httpx.AsyncClient", side_effect=client_factory):
        result = await CloudflareClient(api_token="test_token").verify_token(account_id=account_id)
    return result, calls


USER_PATH = "/client/v4/user/tokens/verify"
ACCOUNT_PATH = f"/client/v4/accounts/{ACCOUNT_ID}/tokens/verify"
OK = {"success": True, "errors": [], "result": {"id": "abc", "status": "active"}}
INVALID = {"success": False, "errors": [{"code": 1000, "message": "Invalid API Token"}], "result": None}


@pytest.mark.asyncio
async def test_client_verifies_account_token_first():
    result, calls = await _verify_with({ACCOUNT_PATH: httpx.Response(200, json=OK)}, ACCOUNT_ID)
    assert result["status"] == "active"
    assert calls == [ACCOUNT_PATH]


@pytest.mark.asyncio
async def test_client_falls_back_to_user_token():
    result, calls = await _verify_with(
        {ACCOUNT_PATH: httpx.Response(401, json=INVALID), USER_PATH: httpx.Response(200, json=OK)}, ACCOUNT_ID
    )
    assert result["status"] == "active"
    assert calls == [ACCOUNT_PATH, USER_PATH]


@pytest.mark.asyncio
async def test_client_raises_on_invalid_token():
    with pytest.raises(AccessUnauthorized, match="Invalid API Token"):
        await _verify_with({USER_PATH: httpx.Response(401, json=INVALID)}, None)
