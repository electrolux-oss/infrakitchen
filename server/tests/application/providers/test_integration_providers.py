from typing import Any

import pytest

from application.integrations.schema import (
    AWSIntegrationConfig,
    VaultIntegrationConfig,
)
from application.providers.vault_provider import VaultProviderAdapter

from application.providers import (
    AwsProvider,
    SecretProviderAdapter,
)
from application.providers.aws.aws_provider import AwsAuthentication
from core.adapters.provider_adapters import IntegrationProvider


async def get_account_session(self, region_name: str = "us-east-1"):
    self.environment_variables.update(
        {
            "AWS_ACCESS_KEY_ID": self.aws_access_key_id,
            "AWS_SECRET_ACCESS_KEY": self.aws_secret_access_key.get_decrypted_value(),
            "AWS_SESSION_TOKEN": "session",
            "AWS_ACCOUNT": self.aws_account,
        }
    )


AwsAuthentication.get_account_session = get_account_session  # type: ignore[method-assign]


@pytest.mark.asyncio
async def test_cloud_providers():
    aws_provider: type[AwsProvider] = IntegrationProvider.adapters["aws"]
    kwargs: dict[str, Any] = dict()  # test evnironment variables
    assert aws_provider.__integration_provider_name__ == "aws"
    configuration: AWSIntegrationConfig = AWSIntegrationConfig.model_validate(
        {
            "aws_access_key_id": "test_key",
            "aws_secret_access_key": "test_secret",
            "aws_account": "0123456789012",
            "aws_assumed_role_name": "test_role",
        }
    )
    kwargs["configuration"] = configuration
    provider_instance: AwsProvider = aws_provider(**kwargs)
    assert provider_instance.aws_access_key_id == "test_key"
    assert (
        provider_instance.aws_secret_access_key.get_decrypted_value()
        if provider_instance.aws_secret_access_key
        else None == "test_secret"
    )
    assert provider_instance.aws_account == "0123456789012"
    assert provider_instance.aws_assumed_role_name == "test_role"

    await provider_instance.authenticate()
    assert provider_instance.environment_variables["AWS_ACCESS_KEY_ID"] == "test_key"
    assert provider_instance.environment_variables["AWS_SECRET_ACCESS_KEY"] == "test_secret"


@pytest.mark.asyncio
async def test_secret_providers():
    vault_provider: type[VaultProviderAdapter] = SecretProviderAdapter.adapters["vault"]
    kwargs: dict[str, Any] = dict()
    assert vault_provider.__secret_provider_adapter_name__ == "vault"
    configuration: VaultIntegrationConfig = VaultIntegrationConfig.model_validate(
        {
            "vault_domain": "test_domain",
            "vault_token": "test_token",
        }
    )
    kwargs["configuration"] = configuration
    provider_instance: VaultProviderAdapter = vault_provider(**kwargs)
    assert provider_instance.vault_domain == "test_domain"

    await provider_instance.authenticate()
    assert provider_instance.environment_variables["VAULT_TOKEN"] == "test_token"
