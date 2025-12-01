from typing import Any

import pytest

from application.providers import (
    SecretProviderAdapter,
)
from application.secrets.providers.aws_secret_manager import AwsSecretManagerProvider
from application.secrets.providers.custom_secret import CustomSecretProvider
from application.secrets.schema import AWSSecretConfig, CustomSecretConfig
from core.errors import EntityNotFound


async def get_account_session(self, region_name: str = "us-east-1"):
    self.environment_variables.update(
        {
            "AWS_ACCESS_KEY_ID": self.aws_access_key_id,
            "AWS_SECRET_ACCESS_KEY": self.aws_secret_access_key.get_decrypted_value(),
            "AWS_SESSION_TOKEN": "session",
            "AWS_ACCOUNT": self.aws_account,
        }
    )


async def mock_get_secret(self, secret_name: str) -> str:
    return '{"TEST_SECRET": "secret_value"}'


@pytest.mark.asyncio
async def test_custom_secret_providers():
    custom_secret_provider: type[CustomSecretProvider] = SecretProviderAdapter.adapters["custom"]
    kwargs: dict[str, Any] = dict()
    assert custom_secret_provider.__secret_provider_adapter_name__ == "custom"
    configuration: CustomSecretConfig = CustomSecretConfig.model_validate(
        {"secrets": [{"name": "test", "value": "test_value"}]}
    )
    kwargs["configuration"] = configuration
    provider_instance: CustomSecretProvider = custom_secret_provider(**kwargs)

    await provider_instance.add_secrets_to_env()
    assert provider_instance.environment_variables["TF_VAR_test"] == "test_value"


# AWS Secret Manager Provider Tests
@pytest.mark.asyncio
async def test_aws_secret_provider_success(monkeypatch):
    monkeypatch.setattr(
        "application.providers.aws.aws_provider.AwsAuthentication.get_account_session",
        get_account_session,
    )

    monkeypatch.setattr(
        "application.providers.aws.aws_secrets_manager.AwsSecretManager.get_secret",
        mock_get_secret,
    )

    aws_secret_provider: type[AwsSecretManagerProvider] = SecretProviderAdapter.adapters["aws"]
    kwargs: dict[str, Any] = dict()
    assert aws_secret_provider.__secret_provider_adapter_name__ == "aws"
    configuration: AWSSecretConfig = AWSSecretConfig.model_validate(
        {
            "name": "test_secret",
            "aws_region": "us-east-1",
        }
    )
    kwargs["configuration"] = configuration
    kwargs["environment_variables"] = {
        "AWS_ACCESS_KEY_ID": "test_key",
        "AWS_SECRET_ACCESS_KEY": "test_secret",
        "AWS_ACCOUNT": "0123456789012",
    }
    provider_instance: AwsSecretManagerProvider = aws_secret_provider(**kwargs)

    await provider_instance.add_secrets_to_env()
    assert provider_instance.environment_variables["TF_VAR_TEST_SECRET"] == "secret_value"


@pytest.mark.asyncio
async def test_aws_secret_provider_not_found(monkeypatch):
    monkeypatch.setattr(
        "application.providers.aws.aws_provider.AwsAuthentication.get_account_session",
        get_account_session,
    )

    async def mock_get_secret_not_found(self, secret_name: str) -> str:
        raise EntityNotFound("Secret not found")

    monkeypatch.setattr(
        "application.providers.aws.aws_secrets_manager.AwsSecretManager.get_secret",
        mock_get_secret_not_found,
    )

    aws_secret_provider: type[AwsSecretManagerProvider] = SecretProviderAdapter.adapters["aws"]
    kwargs: dict[str, Any] = dict()
    configuration: AWSSecretConfig = AWSSecretConfig.model_validate(
        {
            "name": "non_existent_secret",
            "aws_region": "us-east-1",
        }
    )
    kwargs["configuration"] = configuration
    kwargs["environment_variables"] = {
        "AWS_ACCESS_KEY_ID": "test_key",
        "AWS_SECRET_ACCESS_KEY": "test_secret",
        "AWS_ACCOUNT": "0123456789012",
    }
    provider_instance: AwsSecretManagerProvider = aws_secret_provider(**kwargs)

    with pytest.raises(EntityNotFound) as excinfo:
        await provider_instance.add_secrets_to_env()
    assert "Secret not found" in str(excinfo.value)
