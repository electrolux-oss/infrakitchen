from typing import Literal, cast
from lorem import get_sentence
from sqlalchemy.ext.asyncio import AsyncSession
from application.integrations.dependencies import get_integration_service
from application.storages.dependencies import get_storage_service
from application.storages.model import Storage
from application.storages.schema import AWSStorageConfig, AzureRMStorageConfig, StorageCreate
from core.constants.model import ModelState, ModelStatus
from core.users.model import UserDTO
from fixtures.logs import generate_logs
from fixtures.utils import change_state


async def insert_storages(session: AsyncSession, env: str, user: UserDTO):
    storage_configs = {
        "aws": AWSStorageConfig(
            aws_bucket_name=f"test_bucket_{env}",
            aws_region=f"test_region_{env}",
            storage_provider="aws",
        ),
        "azurerm": AzureRMStorageConfig(
            azurerm_resource_group_name=f"test_group_{env}",
            azurerm_storage_account_name=f"test_account_{env}",
            azurerm_container_name=f"test_container_{env}",
            storage_provider="azurerm",
        ),
    }

    storage_service = get_storage_service(session=session)
    integration_service = get_integration_service(session=session)

    for provider, config in storage_configs.items():
        integration = await integration_service.get_all(
            filter={
                "integration_type": "cloud",
                "name": f"{provider}_{env}_account",
                "integration_provider": provider,
            }
        )

        assert len(integration) > 0, f"Integration not found for {provider} in {env}"

        storage = StorageCreate(
            name=f"{env}_{provider}_storage",
            description=get_sentence(),
            storage_type="tofu",
            storage_provider=cast(
                Literal["aws", "azurerm"],
                provider,
            ),
            integration_id=integration[0].id,
            configuration=config,
            labels=[provider, "storage", "tofu"],
        )
        created_storage = await storage_service.create(storage, user)
        await session.commit()
        await generate_logs(
            session=session,
            entity_name="storage",
            entity_id=str(created_storage.id),
            user_id=str(user.id),
        )

    await change_state(
        session=session,
        entity=Storage,
        state=ModelState.PROVISIONED,
        status=ModelStatus.DONE,
    )
