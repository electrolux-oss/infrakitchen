from typing import Any, TypedDict

from lorem import get_sentence
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.dependencies import get_integration_service
from application.integrations.schema import IntegrationCreate
from application.types import IntegrationProviderType, IntegrationType
from core.users.model import UserDTO


class IntegrationFixture(TypedDict):
    name: str
    description: str
    integration_type: IntegrationType
    integration_provider: IntegrationProviderType
    configuration: Any
    labels: list[str]


integration_fixtures: list[IntegrationFixture] = [
    {
        "name": "Git Public Repo",
        "description": get_sentence(),
        "integration_type": "git",
        "integration_provider": "git_public",
        "configuration": {
            "integration_provider": "git_public",
        },
        "labels": ["git", "integration", "public"],
    },
    {
        "name": "GitHub Account",
        "description": get_sentence(),
        "integration_type": "git",
        "integration_provider": "github",
        "configuration": {
            "integration_provider": "github",
            "github_client_id": "test_client_id",
            "github_client_secret": "test_client_secret",
        },
        "labels": ["github", "integration", "git"],
    },
    {
        "name": "Bitbucket Account",
        "description": get_sentence(),
        "integration_type": "git",
        "integration_provider": "bitbucket",
        "configuration": {
            "integration_provider": "bitbucket",
            "bitbucket_user": "test_user@example.com",
            "bitbucket_key": "test_key",
        },
        "labels": ["bitbucket", "integration", "git"],
    },
    {
        "name": "GitLab Account",
        "description": get_sentence(),
        "integration_type": "git",
        "integration_provider": "gitlab",
        "configuration": {
            "integration_provider": "gitlab",
            "gitlab_url": "https://gitlab.com",
            "gitlab_token": "test_token",
        },
        "labels": ["gitlab", "integration", "git"],
    },
    {
        "name": "Mongodb Atlas",
        "description": get_sentence(),
        "integration_type": "cloud",
        "integration_provider": "mongodb_atlas",
        "configuration": {
            "integration_provider": "mongodb_atlas",
            "mongodb_atlas_public_key": "test_public_key",
            "mongodb_atlas_private_key": "test_private_key",
            "mongodb_atlas_org_id": "test_project_id",
        },
        "labels": ["mongodb_atlas", "integration", "database"],
    },
    {
        "name": "Datadog",
        "description": get_sentence(),
        "integration_type": "cloud",
        "integration_provider": "datadog",
        "configuration": {
            "integration_provider": "datadog",
            "datadog_api_url": "https://api.datadoghq.com",
            "datadog_api_key": "test_api_key",
            "datadog_app_key": "test_app_key",
        },
        "labels": ["datadog", "integration", "monitoring"],
    },
]


def get_env_integration_fixtures(env: str) -> list[IntegrationFixture]:
    return [
        {
            "name": f"AWS {env.capitalize()} Account",
            "description": get_sentence(),
            "integration_type": "cloud",
            "integration_provider": "aws",
            "configuration": {
                "integration_provider": "aws",
                "aws_access_key_id": f"test_key_{env}",
                "aws_secret_access_key": f"test_secret_{env}",
                "aws_account": f"test_account_{env}",
                "aws_assumed_role_name": f"test_assume_role{env}",
            },
            "labels": ["aws", "integration", "cloud"],
        },
        {
            "name": f"AZURERM {env.capitalize()} Account",
            "description": get_sentence(),
            "integration_type": "cloud",
            "integration_provider": "azurerm",
            "configuration": {
                "integration_provider": "azurerm",
                "client_id": f"test_client_id_{env}",
                "client_secret": f"test_client_secret_{env}",
                "tenant_id": f"test_tenant_{env}",
                "subscription_id": f"test_subscription_{env}",
            },
            "labels": ["azurerm", "integration", "cloud"],
        },
        {
            "name": f"GCP {env.capitalize()} Account",
            "description": get_sentence(),
            "integration_type": "cloud",
            "integration_provider": "gcp",
            "configuration": {
                "integration_provider": "gcp",
                "gcp_project_id": f"test_project_{env}",
                "gcp_service_account_key": f"test_credentials_{env}",
            },
            "labels": ["gcp", "integration", "cloud"],
        },
    ]


async def insert_integrations(session: AsyncSession, user: UserDTO):
    integration_service = get_integration_service(session=session)
    integrations = await integration_service.get_all()
    for fixture in integration_fixtures:
        integration = IntegrationCreate.model_validate(fixture)
        if any(
            intg
            for intg in integrations
            if intg.integration_type == integration.integration_type
            and intg.name == integration.name
            and intg.integration_provider == integration.integration_provider
        ):
            continue

        await integration_service.create_integration(integration, user)
    await session.commit()


async def insert_env_integrations(session: AsyncSession, env: str, user: UserDTO):
    integration_service = get_integration_service(session=session)
    for fixture in get_env_integration_fixtures(env):
        integration = IntegrationCreate.model_validate(fixture)
        intg = await integration_service.get_all(
            filter={
                "integration_type": integration.integration_type,
                "name": integration.name,
                "integration_provider": integration.integration_provider,
            }
        )

        if intg:
            continue

        await integration_service.create_integration(integration, user)
    await session.commit()
