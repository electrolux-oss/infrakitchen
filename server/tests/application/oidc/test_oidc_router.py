# pyright: reportArgumentType=false, reportCallIssue=false
import json
from contextlib import asynccontextmanager
from datetime import datetime
from typing import cast
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from application.integrations.model import Integration
from application.integrations.schema import GCPIntegrationConfig
from application.providers.gcp import gcp_oidc
from application.oidc import router as oidc_router
from core.constants import ModelStatus
from core.models.encrypted_secret import EncryptedSecretStr
from core.users.model import User

AUDIENCE = "//iam.googleapis.com/projects/1/locations/global/workloadIdentityPools/p/providers/pr"


def _integration_from_config(config: GCPIntegrationConfig) -> Integration:
    return Integration(
        id=uuid4(),
        name="gcp-oidc",
        description="",
        integration_type="cloud",
        integration_provider="gcp",
        configuration=config.model_dump(),
        labels=[],
        creator=User(),
        status=ModelStatus.ENABLED,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        created_by=uuid4(),
        revision_number=1,
    )


def _make_integration(**config_overrides):
    private_pem, public_jwk = gcp_oidc.generate_signing_keypair()
    defaults = dict(
        gcp_auth_method="workload_identity_federation_oidc",
        gcp_wif_pool_provider_audience=AUDIENCE,
        gcp_oidc_signing_private_key=EncryptedSecretStr(private_pem),
        gcp_oidc_signing_public_jwk=json.dumps(public_jwk),
        gcp_project_id="demo-project",
        integration_provider="gcp",
    )
    defaults.update(config_overrides)
    config = GCPIntegrationConfig(**defaults)
    return _integration_from_config(config), public_jwk


def _patch_crud(monkeypatch, integration):
    @asynccontextmanager
    async def fake_session():
        yield Mock()

    monkeypatch.setattr(oidc_router, "get_async_session", fake_session)

    crud_instance = Mock()
    crud_instance.get_by_id = AsyncMock(return_value=integration)
    monkeypatch.setattr(oidc_router, "IntegrationCRUD", Mock(return_value=crud_instance))


class TestOidcEndpoints:
    @pytest.mark.asyncio
    async def test_openid_configuration(self, monkeypatch):
        monkeypatch.setenv("INFRAKITCHEN_URL", "https://ik.example.com")
        integration, _ = _make_integration()
        _patch_crud(monkeypatch, integration)

        integration_id = "11111111-1111-1111-1111-111111111111"
        doc = await oidc_router.openid_configuration(integration_id)

        assert doc["issuer"] == f"https://ik.example.com/oidc/{integration_id}"
        assert doc["jwks_uri"] == f"https://ik.example.com/oidc/{integration_id}/jwks.json"
        assert doc["id_token_signing_alg_values_supported"] == ["RS256"]

    @pytest.mark.asyncio
    async def test_jwks_returns_public_key_only(self, monkeypatch):
        monkeypatch.setenv("INFRAKITCHEN_URL", "https://ik.example.com")
        integration, public_jwk = _make_integration()
        _patch_crud(monkeypatch, integration)

        result = await oidc_router.jwks("11111111-1111-1111-1111-111111111111")
        keys = cast(list[dict[str, object]], result["keys"])

        assert result == {"keys": [public_jwk]}
        # never leak private components
        assert "d" not in keys[0]

    @pytest.mark.asyncio
    async def test_missing_integration_returns_404(self, monkeypatch):
        _patch_crud(monkeypatch, None)
        with pytest.raises(HTTPException) as exc:
            await oidc_router.jwks("11111111-1111-1111-1111-111111111111")
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_non_oidc_integration_returns_404(self, monkeypatch):
        service_account_integration = _integration_from_config(
            GCPIntegrationConfig(
                gcp_auth_method="service_account_key",
                gcp_service_account_key=EncryptedSecretStr('{"type":"service_account"}'),
                gcp_project_id="demo-project",
                integration_provider="gcp",
            )
        )
        _patch_crud(monkeypatch, service_account_integration)

        with pytest.raises(HTTPException) as exc:
            await oidc_router.jwks("11111111-1111-1111-1111-111111111111")
        assert exc.value.status_code == 404
