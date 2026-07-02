from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration
from application.secrets.dependencies import get_secret_service
from application.secrets.schema import SecretCreate
from core.users.model import UserDTO


async def insert_secrets(session: AsyncSession, envs: list[str], user: UserDTO):
    await insert_custom_secrets(session, envs, user)
    secret_providers = ["aws", "gcp"]
    for provider in secret_providers:
        await insert_cloud_secrets(session, envs, provider, user)


async def insert_custom_secrets(session: AsyncSession, envs: list[str], user: UserDTO):
    secret_service = get_secret_service(session=session)
    for env in envs:
        body = {
            "name": f"{env}_secret",
            "description": f"Secret for {env} environment",
            "secret_type": "tofu",
            "secret_provider": "custom",
            "configuration": {
                "secret_provider": "custom",
                "secrets": [
                    {
                        "name": f"{env}_secret_key",
                        "value": "encrypted_value_placeholder",
                    }
                ],
            },
        }
        secret = SecretCreate.model_validate(body)

        await secret_service.create_secret(secret, user)
        await session.commit()


async def insert_cloud_secrets(session: AsyncSession, envs: list[str], provider: str, user: UserDTO):
    secret_service = get_secret_service(session=session)

    for env in envs:
        query = select(Integration).where(
            Integration.integration_type == "cloud",
            Integration.integration_provider == provider,
            Integration.name.ilike(f"%{env.capitalize()}%"),
        )
        result = await session.execute(query)
        integrations = result.scalars().all()
        body = {
            "name": f"{env}_aws_secret",
            "description": f"{provider.upper()} Secret for {env} environment",
            "secret_type": "tofu",
            "secret_provider": provider,
            "integration_id": integrations[0].id if integrations else None,
            "configuration": {
                "name": f"{env}_aws_secret_config",
                "aws_region": "us-east-1",
                "secret_provider": provider,
            },
        }
        secret = SecretCreate.model_validate(body)

        await secret_service.create_secret(secret, user)
        await session.commit()
