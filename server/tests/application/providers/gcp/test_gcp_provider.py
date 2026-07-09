from pathlib import Path

import json

import pytest

from application.integrations.schema import GCPIntegrationConfig
from application.providers.gcp import gcp_oidc
from application.providers.gcp.gcp_provider import GcpProvider
from core.errors import CloudWrongCredentials
from core.models.encrypted_secret import EncryptedSecretStr


SERVICE_ACCOUNT_JSON = '{"type":"service_account","project_id":"demo-project"}'
OIDC_AUDIENCE = "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/pool/providers/provider"


class TestGCPIntegrationConfig:
    def test_service_account_auth_requires_service_account_key(self):
        with pytest.raises(ValueError, match="service account key"):
            GCPIntegrationConfig(
                gcp_auth_method="service_account_key",
                gcp_project_id="demo-project",
                integration_provider="gcp",
            )

    def test_oidc_auth_requires_pool_provider_audience(self):
        with pytest.raises(ValueError, match="pool provider audience"):
            GCPIntegrationConfig(
                gcp_auth_method="workload_identity_federation_oidc",
                gcp_project_id="demo-project",
                integration_provider="gcp",
            )

    def test_oidc_get_secrets_includes_signing_key(self):
        oidc_config = GCPIntegrationConfig(
            gcp_auth_method="workload_identity_federation_oidc",
            gcp_wif_pool_provider_audience=OIDC_AUDIENCE,
            gcp_oidc_signing_private_key=EncryptedSecretStr(
                "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----"
            ),
            gcp_oidc_signing_public_jwk='{"kid":"abc"}',
            gcp_project_id="demo-project",
            integration_provider="gcp",
        )
        assert [secret_name for secret_name, _ in oidc_config.get_secrets()] == ["gcp_oidc_signing_private_key"]

    def test_oidc_rejects_https_audience_format(self):
        with pytest.raises(ValueError, match="full provider resource name"):
            GCPIntegrationConfig(
                gcp_auth_method="workload_identity_federation_oidc",
                gcp_wif_pool_provider_audience=(
                    "https://iam.googleapis.com/projects/123/locations/global/"
                    "workloadIdentityPools/pool/providers/provider"
                ),
                gcp_project_id="demo-project",
                integration_provider="gcp",
            )

    def test_oidc_rejects_non_canonical_audience_format(self):
        with pytest.raises(ValueError, match="must match"):
            GCPIntegrationConfig(
                gcp_auth_method="workload_identity_federation_oidc",
                gcp_wif_pool_provider_audience="//iam.googleapis.com/projects/abc/providers/provider",
                gcp_project_id="demo-project",
                integration_provider="gcp",
            )

    def test_oidc_accepts_service_account_impersonation_url_alias(self):
        config = GCPIntegrationConfig.model_validate(
            {
                "gcp_auth_method": "workload_identity_federation_oidc",
                "gcp_wif_pool_provider_audience": OIDC_AUDIENCE,
                "service_account_impersonation_url": (
                    "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"
                    "sa@proj.iam.gserviceaccount.com:generateAccessToken"
                ),
                "gcp_project_id": "demo-project",
                "integration_provider": "gcp",
            }
        )

        assert (
            config.gcp_wif_service_account_impersonation_url
            == "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"
            "sa@proj.iam.gserviceaccount.com:generateAccessToken"
        )

    def test_oidc_rejects_invalid_service_account_impersonation_url(self):
        with pytest.raises(ValueError, match="service account impersonation URL"):
            GCPIntegrationConfig.model_validate(
                {
                    "gcp_auth_method": "workload_identity_federation_oidc",
                    "gcp_wif_pool_provider_audience": OIDC_AUDIENCE,
                    "service_account_impersonation_url": "https://example.com/not-iamcredentials",
                    "gcp_project_id": "demo-project",
                    "integration_provider": "gcp",
                }
            )

    def test_get_secrets_returns_only_active_auth_secret(self):
        service_account_config = GCPIntegrationConfig(
            gcp_auth_method="service_account_key",
            gcp_service_account_key=EncryptedSecretStr(SERVICE_ACCOUNT_JSON),
            gcp_project_id="demo-project",
            integration_provider="gcp",
        )
        oidc_config = GCPIntegrationConfig(
            gcp_auth_method="workload_identity_federation_oidc",
            gcp_wif_pool_provider_audience=OIDC_AUDIENCE,
            gcp_oidc_signing_private_key=EncryptedSecretStr(
                "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----"
            ),
            gcp_oidc_signing_public_jwk='{"kid":"abc"}',
            gcp_project_id="demo-project",
            integration_provider="gcp",
        )

        assert [secret_name for secret_name, _ in service_account_config.get_secrets()] == ["gcp_service_account_key"]
        assert [secret_name for secret_name, _ in oidc_config.get_secrets()] == ["gcp_oidc_signing_private_key"]


class TestGcpProviderAuthentication:
    @pytest.mark.asyncio
    async def test_authenticate_service_account_writes_credentials_file(self, tmp_path, monkeypatch):
        captured_info = []

        def mock_load_credentials_from_info(credentials_info: str):
            captured_info.append(credentials_info)
            return object()

        monkeypatch.setattr(
            "application.providers.gcp.gcp_provider.load_gcp_credentials_from_info",
            mock_load_credentials_from_info,
        )

        provider = GcpProvider(
            configuration={
                "gcp_auth_method": "service_account_key",
                "gcp_service_account_key": SERVICE_ACCOUNT_JSON,
                "gcp_project_id": "demo-project",
                "integration_provider": "gcp",
            }
        )
        provider.workspace_root = str(tmp_path)

        await provider.authenticate()

        credentials_path = Path(provider.environment_variables["GOOGLE_APPLICATION_CREDENTIALS"])
        assert credentials_path == tmp_path / "gcp_service_account_key.json"
        assert credentials_path.read_text() == SERVICE_ACCOUNT_JSON
        assert provider.environment_variables["GOOGLE_PROJECT"] == "demo-project"
        assert captured_info == [SERVICE_ACCOUNT_JSON]

    @pytest.mark.asyncio
    @pytest.mark.asyncio
    async def test_authenticate_invalid_credentials_json_raises(self, monkeypatch):
        def mock_load_credentials_from_info(credentials_info: str):
            raise ValueError("invalid")

        monkeypatch.setattr(
            "application.providers.gcp.gcp_provider.load_gcp_credentials_from_info",
            mock_load_credentials_from_info,
        )

        provider = GcpProvider(
            configuration={
                "gcp_auth_method": "service_account_key",
                "gcp_service_account_key": SERVICE_ACCOUNT_JSON,
                "gcp_project_id": "demo-project",
                "integration_provider": "gcp",
            }
        )

        with pytest.raises(CloudWrongCredentials, match="Error loading GCP credentials"):
            await provider.authenticate()


class TestGcpProviderOidcAuthentication:
    @pytest.mark.asyncio
    async def test_authenticate_oidc_writes_token_and_external_account(self, tmp_path, monkeypatch):
        monkeypatch.setenv("INFRAKITCHEN_URL", "https://ik.example.com")

        captured_info = []

        def mock_load_credentials_from_info(credentials_info: str):
            captured_info.append(credentials_info)
            return object()

        monkeypatch.setattr(
            "application.providers.gcp.gcp_provider.load_gcp_credentials_from_info",
            mock_load_credentials_from_info,
        )

        private_pem, public_jwk = gcp_oidc.generate_signing_keypair()
        integration_id = "11111111-1111-1111-1111-111111111111"

        provider = GcpProvider(
            configuration={
                "gcp_auth_method": "workload_identity_federation_oidc",
                "gcp_wif_pool_provider_audience": OIDC_AUDIENCE,
                "gcp_wif_service_account_email": "sa@proj.iam.gserviceaccount.com",
                "gcp_oidc_signing_private_key": private_pem,
                "gcp_oidc_signing_public_jwk": json.dumps(public_jwk),
                "gcp_project_id": "demo-project",
                "integration_provider": "gcp",
            },
            integration_id=integration_id,
        )
        provider.workspace_root = str(tmp_path)

        await provider.authenticate()

        # subject token file written
        subject_token_path = tmp_path / "gcp_oidc_subject_token.jwt"
        assert subject_token_path.exists()

        # external_account config written and points at the token file
        credentials_path = Path(provider.environment_variables["GOOGLE_APPLICATION_CREDENTIALS"])
        assert credentials_path == tmp_path / "gcp_wif_credential_config.json"
        config = json.loads(credentials_path.read_text())
        assert config["type"] == "external_account"
        assert config["audience"] == OIDC_AUDIENCE
        assert config["credential_source"]["file"] == str(subject_token_path)
        assert "service_account_impersonation_url" in config
        assert provider.environment_variables["GOOGLE_PROJECT"] == "demo-project"
        # the built config was validated
        assert captured_info and json.loads(captured_info[0])["type"] == "external_account"

    @pytest.mark.asyncio
    async def test_authenticate_oidc_prefers_explicit_impersonation_url(self, tmp_path, monkeypatch):
        monkeypatch.setenv("INFRAKITCHEN_URL", "https://ik.example.com")

        monkeypatch.setattr(
            "application.providers.gcp.gcp_provider.load_gcp_credentials_from_info",
            lambda credentials_info: object(),
        )

        private_pem, public_jwk = gcp_oidc.generate_signing_keypair()

        provider = GcpProvider(
            configuration={
                "gcp_auth_method": "workload_identity_federation_oidc",
                "gcp_wif_pool_provider_audience": OIDC_AUDIENCE,
                "gcp_wif_service_account_email": "sa-from-email@proj.iam.gserviceaccount.com",
                "service_account_impersonation_url": (
                    "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"
                    "sa-from-url@proj.iam.gserviceaccount.com:generateAccessToken"
                ),
                "gcp_oidc_signing_private_key": private_pem,
                "gcp_oidc_signing_public_jwk": json.dumps(public_jwk),
                "gcp_project_id": "demo-project",
                "integration_provider": "gcp",
            },
            integration_id="11111111-1111-1111-1111-111111111111",
        )
        provider.workspace_root = str(tmp_path)

        await provider.authenticate()

        credentials_path = Path(provider.environment_variables["GOOGLE_APPLICATION_CREDENTIALS"])
        config = json.loads(credentials_path.read_text())
        assert (
            config["service_account_impersonation_url"]
            == "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"
            "sa-from-url@proj.iam.gserviceaccount.com:generateAccessToken"
        )

    @pytest.mark.asyncio
    async def test_authenticate_oidc_without_integration_id_raises(self, tmp_path, monkeypatch):
        monkeypatch.setenv("INFRAKITCHEN_URL", "https://ik.example.com")
        private_pem, public_jwk = gcp_oidc.generate_signing_keypair()

        provider = GcpProvider(
            configuration={
                "gcp_auth_method": "workload_identity_federation_oidc",
                "gcp_wif_pool_provider_audience": OIDC_AUDIENCE,
                "gcp_oidc_signing_private_key": private_pem,
                "gcp_oidc_signing_public_jwk": json.dumps(public_jwk),
                "gcp_project_id": "demo-project",
                "integration_provider": "gcp",
            },
        )
        provider.workspace_root = str(tmp_path)

        with pytest.raises(CloudWrongCredentials, match="Integration id is required"):
            await provider.authenticate()

    @pytest.mark.asyncio
    async def test_authenticate_oidc_missing_signing_key_raises(self, tmp_path, monkeypatch):
        monkeypatch.setenv("INFRAKITCHEN_URL", "https://ik.example.com")

        provider = GcpProvider(
            configuration={
                "gcp_auth_method": "workload_identity_federation_oidc",
                "gcp_wif_pool_provider_audience": OIDC_AUDIENCE,
                "gcp_project_id": "demo-project",
                "integration_provider": "gcp",
            },
            integration_id="11111111-1111-1111-1111-111111111111",
        )
        provider.workspace_root = str(tmp_path)

        with pytest.raises(CloudWrongCredentials, match="signing key is missing"):
            await provider.authenticate()
