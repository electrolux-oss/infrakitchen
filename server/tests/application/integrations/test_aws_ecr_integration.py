import base64
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
from pydantic import ValidationError

from application.integrations.schema import AWSECRIntegrationConfig, AWSIntegrationConfig, IntegrationCreate
from application.providers.container_registry.aws_ecr import AwsEcrProvider
from core.errors import CannotProceed

AWS_INTEGRATION_ID = uuid4()

OWN_CREDENTIALS = {
    "aws_account": "123456789012",
    "aws_region": "eu-west-1",
    "aws_access_key_id": "AKIATEST",
    "aws_secret_access_key": "secret",
    "integration_provider": "aws_ecr",
}

LINKED = {
    "aws_account": "123456789012",
    "aws_region": "eu-west-1",
    "aws_integration_id": str(AWS_INTEGRATION_ID),
    "integration_provider": "aws_ecr",
}

AWS_CONFIGURATION = {
    "aws_account": "210987654321",
    "aws_access_key_id": "AKIALINKED",
    "aws_secret_access_key": "linked-secret",
    "aws_assumed_role_name": "ik-role",
    "integration_provider": "aws",
}


class TestAwsEcrConfig:
    def test_own_credentials(self):
        config = AWSECRIntegrationConfig.model_validate(OWN_CREDENTIALS)
        assert config.registry_host == "123456789012.dkr.ecr.eu-west-1.amazonaws.com"
        assert [name for name, _ in config.get_secrets()] == ["aws_secret_access_key"]

    def test_linked_integration(self):
        config = AWSECRIntegrationConfig.model_validate(LINKED)
        assert config.aws_integration_id == AWS_INTEGRATION_ID
        assert config.get_secrets() == []

    def test_china_partition_host(self):
        config = AWSECRIntegrationConfig.model_validate({**OWN_CREDENTIALS, "aws_partition": "aws-cn"})
        assert config.registry_host.endswith(".amazonaws.com.cn")

    def test_requires_an_auth_source(self):
        with pytest.raises(ValidationError, match="requires an AWS integration or an AWS access key"):
            AWSECRIntegrationConfig.model_validate({"aws_account": "123456789012"})

    def test_rejects_both_auth_sources(self):
        with pytest.raises(ValidationError, match="not both"):
            AWSECRIntegrationConfig.model_validate({**LINKED, "aws_access_key_id": "AKIATEST"})

    def test_rejects_invalid_account(self):
        with pytest.raises(ValidationError):
            AWSECRIntegrationConfig.model_validate({**OWN_CREDENTIALS, "aws_account": "1234"})

    def test_integration_create(self):
        integration = IntegrationCreate.model_validate(
            {
                "name": "ecr",
                "integration_type": "container_registry",
                "integration_provider": "aws_ecr",
                "configuration": LINKED,
            }
        )
        assert isinstance(integration.configuration, AWSECRIntegrationConfig)


class TestResolveLinkedAwsConfiguration:
    async def test_not_linked_returns_none(self, mock_integration_service, mock_integration_crud):
        config = AWSECRIntegrationConfig.model_validate(OWN_CREDENTIALS)
        assert await mock_integration_service.resolve_linked_aws_configuration(config) is None
        mock_integration_crud.get_by_id.assert_not_awaited()

    async def test_returns_aws_configuration(self, mock_integration_service, mock_integration_crud, monkeypatch):
        mock_integration_crud.get_by_id.return_value = SimpleNamespace(integration_provider="aws")
        monkeypatch.setattr(
            "application.integrations.service.IntegrationDTO.model_validate",
            Mock(return_value=SimpleNamespace(configuration=AWSIntegrationConfig.model_validate(AWS_CONFIGURATION))),
        )
        with patch("application.integrations.service.user_has_access_to_entity", AsyncMock(return_value=True)):
            result = await mock_integration_service.resolve_linked_aws_configuration(
                AWSECRIntegrationConfig.model_validate(LINKED), requester=Mock()
            )
        assert isinstance(result, AWSIntegrationConfig)
        assert result.aws_account == "210987654321"
        mock_integration_crud.get_by_id.assert_awaited_once_with(AWS_INTEGRATION_ID)

    async def test_rejects_non_aws_integration(self, mock_integration_service, mock_integration_crud):
        mock_integration_crud.get_by_id.return_value = SimpleNamespace(integration_provider="gcp")
        with pytest.raises(ValueError, match="not found"):
            await mock_integration_service.resolve_linked_aws_configuration(
                AWSECRIntegrationConfig.model_validate(LINKED)
            )

    async def test_rejects_missing_integration(self, mock_integration_service, mock_integration_crud):
        mock_integration_crud.get_by_id.return_value = None
        with pytest.raises(ValueError, match="not found"):
            await mock_integration_service.resolve_linked_aws_configuration(
                AWSECRIntegrationConfig.model_validate(LINKED)
            )

    async def test_rejects_integration_without_access(self, mock_integration_service, mock_integration_crud):
        mock_integration_crud.get_by_id.return_value = SimpleNamespace(integration_provider="aws")
        with (
            patch("application.integrations.service.user_has_access_to_entity", AsyncMock(return_value=False)),
            pytest.raises(ValueError, match="not found"),
        ):
            await mock_integration_service.resolve_linked_aws_configuration(
                AWSECRIntegrationConfig.model_validate(LINKED), requester=Mock()
            )

    async def test_validate_passes_aws_configuration_to_adapter(self, mock_integration_service, monkeypatch):
        aws_configuration = AWSIntegrationConfig.model_validate(AWS_CONFIGURATION)
        monkeypatch.setattr(
            mock_integration_service, "resolve_linked_aws_configuration", AsyncMock(return_value=aws_configuration)
        )
        adapter_instance = AsyncMock()
        adapter_instance.is_valid.return_value = True
        adapter_cls = Mock(return_value=adapter_instance)
        monkeypatch.setattr("core.adapters.provider_adapters.IntegrationProvider.adapters", {"aws_ecr": adapter_cls})

        config = AWSECRIntegrationConfig.model_validate(LINKED)
        result = await mock_integration_service.validate(integration_config=config, integration_provider="aws_ecr")

        assert result.is_valid is True
        assert adapter_cls.call_args.kwargs["aws_configuration"] is aws_configuration


def ecr_session(token: str) -> Mock:
    ecr_client = Mock()
    ecr_client.get_authorization_token = AsyncMock(
        return_value={"authorizationData": [{"authorizationToken": token, "expiresAt": None}]}
    )

    @asynccontextmanager
    async def create_client(*args, **kwargs):
        yield ecr_client

    session = Mock()
    session.create_client = Mock(side_effect=create_client)
    return session


class TestAwsEcrProvider:
    def test_linked_requires_resolved_aws_configuration(self):
        with pytest.raises(CannotProceed, match="was not resolved"):
            _ = AwsEcrProvider(configuration=LINKED)

    async def test_authenticate_with_own_credentials(self):
        provider = AwsEcrProvider(configuration=OWN_CREDENTIALS)
        token = base64.b64encode(b"AWS:registry-password").decode()
        session = ecr_session(token)

        with (
            patch("application.providers.aws.aws_provider.AwsAuthentication.get_account_session", AsyncMock()),
            patch("application.providers.container_registry.aws_ecr.get_session", return_value=session),
        ):
            provider._aws_authentication.environment_variables.update(  # pyright: ignore[reportPrivateUsage]
                {"AWS_ACCESS_KEY_ID": "AKIATEST", "AWS_SECRET_ACCESS_KEY": "secret"}
            )
            credentials = await provider.get_registry_credentials()

        assert credentials.registry_host == "123456789012.dkr.ecr.eu-west-1.amazonaws.com"
        assert credentials.username == "AWS"
        assert credentials.password == "registry-password"
        assert session.create_client.call_args.kwargs["region_name"] == "eu-west-1"
        assert await provider.is_valid() is True

    def test_linked_uses_aws_integration_credentials(self):
        provider = AwsEcrProvider(
            configuration=LINKED, aws_configuration=AWSIntegrationConfig.model_validate(AWS_CONFIGURATION)
        )
        aws_authentication = provider._aws_authentication  # pyright: ignore[reportPrivateUsage]
        assert aws_authentication.aws_access_key_id == "AKIALINKED"
        assert aws_authentication.aws_assumed_role_name == "ik-role"
        assert aws_authentication.aws_account == "210987654321"
