from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from application.executors.dependencies import get_executor_service
from application.executors.schema import ExecutorCreate
from application.integrations.model import Integration
from application.source_codes.dependencies import get_source_code_service
from application.storages.dependencies import get_storage_service
from core.users.model import UserDTO


async def insert_executors(session: AsyncSession, user: UserDTO):
    executor_service = get_executor_service(session=session)
    storage_service = get_storage_service(session=session)
    source_code_service = get_source_code_service(session=session)

    query = select(Integration).where(
        Integration.integration_type == "cloud",
        Integration.integration_provider == "aws",
    )
    result = await session.execute(query)
    integrations = result.scalars().all()
    source_code = await source_code_service.get_all()
    assert len(source_code) > 0, "No source code found"

    for integration in integrations:
        storage = await storage_service.get_all(filter={"integration_id": integration.id})

        executor = ExecutorCreate(
            name=f"executor-{integration.id}",
            integration_ids=[integration.id],
            source_code_id=source_code[0].id,
            source_code_branch="main",
            source_code_folder=f"examples/{integration.integration_provider}/{integration.integration_type}",
            storage_id=storage[0].id if storage else None,
            storage_path=f"/executors/{integration.id}/" if storage else None,
            command_args="-var=env=dev -var=region=us-east-1 -var-file=vars.tfvars",
        )
        await executor_service.create(executor=executor, requester=user)

    await session.commit()
