"""Helpers for GCP Workload Identity Federation via InfraKitchen-issued OIDC tokens.

In this mode InfraKitchen acts as the OIDC identity provider that GCP trusts:

* a per-integration RSA keypair is generated; the public JWK is published at the JWKS
  endpoint (and can be uploaded to GCP for the offline case),
* at authenticate time InfraKitchen mints a short-lived JWT (the *subject token*) signed
  with the private key,
* an ``external_account`` credential configuration is built that points GCP's STS at the
  subject token file; STS verifies the JWT signature against the published JWKS and returns
  GCP credentials.
"""

import json
import time
import uuid
from typing import Any

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

from core.config import Settings

SIGNING_ALGORITHM = "RS256"
SUBJECT_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:jwt"
STS_TOKEN_URL = "https://sts.googleapis.com/v1/token"
DEFAULT_SUBJECT_TOKEN_TTL_SECONDS = 3600


def generate_signing_keypair() -> tuple[str, dict[str, Any]]:
    """Generate an RSA-2048 keypair.

    :return: a tuple of ``(private_key_pem, public_jwk_dict)`` where the JWK contains a stable
        ``kid`` and is annotated for signature use with RS256.
    """
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    public_jwk: dict[str, Any] = json.loads(RSAAlgorithm.to_jwk(private_key.public_key()))
    public_jwk["kid"] = uuid.uuid4().hex
    public_jwk["use"] = "sig"
    public_jwk["alg"] = SIGNING_ALGORITHM
    return private_pem, public_jwk


def issuer_url_for(integration_id: str | uuid.UUID) -> str:
    """Return the OIDC issuer URL for an integration (``<INFRAKITCHEN_URL>/oidc/<id>``)."""
    base_url = Settings().INFRAKITCHEN_URL.rstrip("/")
    if not base_url:
        raise ValueError("INFRAKITCHEN_URL must be configured to use GCP Workload Identity Federation via OIDC.")
    return f"{base_url}/oidc/{integration_id}"


def jwks_url_for(integration_id: str | uuid.UUID) -> str:
    """Return the JWKS URL for an integration (served under ``/oidc``)."""
    base_url = Settings().INFRAKITCHEN_URL.rstrip("/")
    return f"{base_url}/oidc/{integration_id}/jwks.json"


def default_subject_for(integration_id: str | uuid.UUID) -> str:
    return f"infrakitchen-integration-{integration_id}"


def mint_subject_token(
    private_key_pem: str,
    kid: str,
    issuer: str,
    audience: str,
    subject: str,
    ttl_seconds: int = DEFAULT_SUBJECT_TOKEN_TTL_SECONDS,
) -> str:
    """Mint a signed OIDC JWT to be exchanged at GCP STS."""
    now = int(time.time())
    claims = {
        "iss": issuer,
        "sub": subject,
        "aud": audience,
        "iat": now,
        "nbf": now,
        "exp": now + ttl_seconds,
    }
    return jwt.encode(
        claims,
        key=private_key_pem,
        algorithm=SIGNING_ALGORITHM,
        headers={"kid": kid, "alg": SIGNING_ALGORITHM, "typ": "JWT"},
    )


def build_external_account_config(
    audience: str,
    subject_token_path: str,
    service_account_email: str | None = None,
) -> dict[str, Any]:
    """Build a GCP ``external_account`` credential configuration.

    :param audience: the full canonical provider resource name.
    :param subject_token_path: absolute path to the file holding the minted subject token JWT.
    :param service_account_email: when provided, adds ``service_account_impersonation_url`` so GCP
        impersonates that service account; otherwise the federated principal is used directly.
    """
    config: dict[str, Any] = {
        "type": "external_account",
        "audience": audience,
        "subject_token_type": SUBJECT_TOKEN_TYPE,
        "token_url": STS_TOKEN_URL,
        "credential_source": {
            "file": subject_token_path,
            "format": {"type": "text"},
        },
    }
    if service_account_email:
        config["service_account_impersonation_url"] = (
            f"https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"
            f"{service_account_email}:generateAccessToken"
        )
    return config


def build_jwks(public_jwk: dict[str, Any]) -> dict[str, Any]:
    """Wrap a public JWK into a JWKS document (``{"keys": [...]}``)."""
    return {"keys": [public_jwk]}


def build_openid_configuration(issuer: str, jwks_uri: str) -> dict[str, Any]:
    """Build a minimal OIDC discovery document for GCP to consume."""
    return {
        "issuer": issuer,
        "jwks_uri": jwks_uri,
        "response_types_supported": ["id_token"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": [SIGNING_ALGORITHM],
        "scopes_supported": ["openid"],
        "claims_supported": ["iss", "sub", "aud", "iat", "exp"],
    }
