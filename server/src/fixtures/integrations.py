from typing import Literal, cast
from lorem import get_sentence
from sqlalchemy.ext.asyncio import AsyncSession
from application.integrations.dependencies import get_integration_service
from application.integrations.schema import (
    AWSIntegrationConfig,
    AzureRMIntegrationConfig,
    BitbucketIntegrationConfig,
    GithubIntegrationConfig,
    IntegrationCreate,
)
from application.types import IntegrationType
from core.models.encrypted_secret import EncryptedSecretStr
from core.users.model import UserDTO


async def insert_integrations(session: AsyncSession, env: str, user: UserDTO):
    integration_service = get_integration_service(session=session)
    integration_configs = {
        "aws": AWSIntegrationConfig(
            aws_access_key_id=f"test_key_{env}",
            aws_secret_access_key=EncryptedSecretStr(f"test_secret_{env}"),
            aws_account=f"test_account_{env}",
            aws_assumed_role_name=f"test_assume_role{env}",
        ),
        "azurerm": AzureRMIntegrationConfig(
            client_id=f"test_client_id_{env}",
            client_secret=EncryptedSecretStr(f"test_client_secret_{env}"),
            tenant_id=f"test_tenant_{env}",
            subscription_id=f"test_subscription_{env}",
        ),
        "github": GithubIntegrationConfig(
            github_client_id=f"test_client_id_{env}",
            github_client_secret=EncryptedSecretStr(f"test_client_secret_{env}"),
        ),
        "bitbucket": BitbucketIntegrationConfig(
            bitbucket_user=f"test_user_{env}@example.com",
            bitbucket_key=EncryptedSecretStr(f"test_key_{env}"),
        ),
    }

    integration_types: dict[str, IntegrationType] = {
        "aws": "cloud",
        "azurerm": "cloud",
        "github": "git",
        "bitbucket": "git",
    }

    for provider, config in integration_configs.items():
        integration = IntegrationCreate(
            name=f"{provider}_{env}_account",
            description=get_sentence(),
            integration_type=integration_types[provider],
            integration_provider=cast(
                Literal["aws", "azurerm", "azure_devops", "github", "bitbucket", "mongodb_atlas", "datadog"],
                provider,
            ),
            configuration=config,
            labels=[provider, "integration", integration_types[provider]],
        )
        intg = await integration_service.get_all(
            filter={
                "integration_type": integration.integration_type,
                "name": integration.name,
                "integration_provider": integration.integration_provider,
            }
        )

        if intg:
            continue

        await integration_service.create(integration, user)
    await session.commit()
