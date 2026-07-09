import json
from typing import Any, cast

import jwt
import pytest
from jwt.algorithms import RSAAlgorithm

from application.providers.gcp import gcp_oidc

AUDIENCE = "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/pool/providers/provider"


class TestGenerateSigningKeypair:
    def test_generates_pem_and_public_jwk(self):
        private_pem, public_jwk = gcp_oidc.generate_signing_keypair()

        assert "BEGIN PRIVATE KEY" in private_pem
        assert public_jwk["kty"] == "RSA"
        assert public_jwk["use"] == "sig"
        assert public_jwk["alg"] == "RS256"
        assert public_jwk["kid"]
        # public JWK must not carry private components
        assert "d" not in public_jwk

    def test_each_keypair_has_unique_kid(self):
        _, first = gcp_oidc.generate_signing_keypair()
        _, second = gcp_oidc.generate_signing_keypair()
        assert first["kid"] != second["kid"]


class TestMintSubjectToken:
    def test_token_claims_and_signature(self):
        private_pem, public_jwk = gcp_oidc.generate_signing_keypair()
        issuer = "https://ik.example.com/oidc/abc"

        token = gcp_oidc.mint_subject_token(
            private_key_pem=private_pem,
            kid=public_jwk["kid"],
            issuer=issuer,
            audience=AUDIENCE,
            subject="subject-1",
            ttl_seconds=1200,
        )

        header = jwt.get_unverified_header(token)
        assert header["kid"] == public_jwk["kid"]
        assert header["alg"] == "RS256"

        public_key = cast(Any, RSAAlgorithm.from_jwk(json.dumps(public_jwk)))
        claims = jwt.decode(token, key=public_key, algorithms=["RS256"], audience=AUDIENCE)
        assert claims["iss"] == issuer
        assert claims["sub"] == "subject-1"
        assert claims["aud"] == AUDIENCE
        assert claims["exp"] - claims["iat"] == 1200

    def test_token_rejected_with_wrong_key(self):
        private_pem, public_jwk = gcp_oidc.generate_signing_keypair()
        _, other_jwk = gcp_oidc.generate_signing_keypair()

        token = gcp_oidc.mint_subject_token(
            private_key_pem=private_pem,
            kid=public_jwk["kid"],
            issuer="https://ik.example.com/oidc/abc",
            audience=AUDIENCE,
            subject="subject-1",
        )

        wrong_key = cast(Any, RSAAlgorithm.from_jwk(json.dumps(other_jwk)))
        with pytest.raises(jwt.InvalidSignatureError):
            jwt.decode(token, key=wrong_key, algorithms=["RS256"], audience=AUDIENCE)


class TestBuildExternalAccountConfig:
    def test_without_impersonation(self):
        config = gcp_oidc.build_external_account_config(AUDIENCE, "/tmp/token.jwt")
        assert config["type"] == "external_account"
        assert config["audience"] == AUDIENCE
        assert config["subject_token_type"] == "urn:ietf:params:oauth:token-type:jwt"
        assert config["token_url"] == "https://sts.googleapis.com/v1/token"
        assert config["credential_source"] == {
            "file": "/tmp/token.jwt",
            "format": {"type": "text"},
        }
        assert "service_account_impersonation_url" not in config

    def test_with_impersonation(self):
        config = gcp_oidc.build_external_account_config(
            AUDIENCE, "/tmp/token.jwt", service_account_email="sa@proj.iam.gserviceaccount.com"
        )
        assert (
            config["service_account_impersonation_url"]
            == "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"
            "sa@proj.iam.gserviceaccount.com:generateAccessToken"
        )


class TestIssuerAndJwksUrls:
    def test_issuer_and_jwks_urls(self, monkeypatch):
        monkeypatch.setenv("INFRAKITCHEN_URL", "https://ik.example.com/")
        assert gcp_oidc.issuer_url_for("abc") == "https://ik.example.com/oidc/abc"
        assert gcp_oidc.jwks_url_for("abc") == "https://ik.example.com/oidc/abc/jwks.json"

    def test_issuer_requires_configured_url(self, monkeypatch):
        monkeypatch.setenv("INFRAKITCHEN_URL", "")
        with pytest.raises(ValueError, match="INFRAKITCHEN_URL"):
            gcp_oidc.issuer_url_for("abc")


class TestBuildDocuments:
    def test_build_jwks(self):
        _, public_jwk = gcp_oidc.generate_signing_keypair()
        jwks = gcp_oidc.build_jwks(public_jwk)
        assert jwks == {"keys": [public_jwk]}

    def test_build_openid_configuration(self):
        doc = gcp_oidc.build_openid_configuration(
            "https://ik.example.com/oidc/abc",
            "https://ik.example.com/oidc/abc/jwks.json",
        )
        assert doc["issuer"] == "https://ik.example.com/oidc/abc"
        assert doc["jwks_uri"] == "https://ik.example.com/oidc/abc/jwks.json"
        assert doc["id_token_signing_alg_values_supported"] == ["RS256"]
