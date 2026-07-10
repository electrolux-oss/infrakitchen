"""Public OIDC discovery + JWKS endpoints for GCP Workload Identity Federation.

GCP fetches these when an integration's issuer URL is publicly reachable. They expose only public
key material (never the private signing key) and therefore require no authentication

The discovery document and JWKS are served at the domain root under ``/oidc`` so that the issuer
and its public metadata live together.
"""

import json
import uuid

from fastapi import APIRouter, HTTPException

from application.integrations.crud import IntegrationCRUD
from application.integrations.model import IntegrationDTO
from application.integrations.schema import GCPIntegrationConfig
from application.providers.gcp import gcp_oidc
from core.dependencies import get_async_session

oidc_router = APIRouter(prefix="/oidc", tags=["OIDC"])


async def _get_gcp_oidc_config(integration_id: uuid.UUID) -> GCPIntegrationConfig:
    async with get_async_session() as session:
        integration = await IntegrationCRUD(session=session).get_by_id(integration_id)
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration not found")

    config = IntegrationDTO.model_validate(integration).configuration
    if (
        not isinstance(config, GCPIntegrationConfig)
        or config.gcp_auth_method != "workload_identity_federation_oidc"
        or not config.gcp_oidc_signing_public_jwk
    ):
        raise HTTPException(status_code=404, detail="Integration does not expose an OIDC provider")
    return config


@oidc_router.get("/{integration_id}/.well-known/openid-configuration")
async def openid_configuration(integration_id: uuid.UUID) -> dict[str, object]:
    await _get_gcp_oidc_config(integration_id)
    issuer = gcp_oidc.issuer_url_for(integration_id)
    jwks_uri = gcp_oidc.jwks_url_for(integration_id)
    return gcp_oidc.build_openid_configuration(issuer=issuer, jwks_uri=jwks_uri)


@oidc_router.get("/{integration_id}/jwks.json")
async def jwks(integration_id: uuid.UUID) -> dict[str, object]:
    config = await _get_gcp_oidc_config(integration_id)
    public_jwk = json.loads(config.gcp_oidc_signing_public_jwk or "{}")
    return gcp_oidc.build_jwks(public_jwk)
