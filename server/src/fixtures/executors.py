from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from application.executors.dependencies import get_executor_service
from application.executors.schema import ExecutorCreate
from application.source_codes.dependencies import get_source_code_service
from application.storages.dependencies import get_storage_service
from core.users.model import UserDTO


@dataclass(frozen=True)
class ExecutorFixture:
    name: str
    description: str
    folder: str
    labels: list[str]


# Dummy task modules of the example templates repo, they need no cloud integration
# and take their variables from tfvars/<env>.tfvars
EXECUTORS: list[ExecutorFixture] = [
    ExecutorFixture(
        name="db-migration",
        description="Simulates applying database migrations",
        folder="executors/01-db-migration",
        labels=["migration"],
    ),
    ExecutorFixture(
        name="data-import",
        description="Simulates importing a dataset of records",
        folder="executors/02-data-import",
        labels=["import"],
    ),
    ExecutorFixture(
        name="cleanup",
        description="Simulates removing stale items from a target",
        folder="executors/03-cleanup",
        labels=["cleanup"],
    ),
]
ENVS = ["dev", "staging", "prod"]


async def insert_executors(session: AsyncSession, user: UserDTO):
    executor_service = get_executor_service(session=session)
    source_code_service = get_source_code_service(session=session)
    storage_service = get_storage_service(session=session)

    source_code = await source_code_service.get_all()
    assert len(source_code) > 0, "No source code found"

    for env in ENVS:
        # The dummy modules need no cloud, so their state goes to the PostgreSQL storage
        storages = await storage_service.get_all(filter={"name": f"{env}_postgresql_storage"})
        assert len(storages) > 0, f"No PostgreSQL storage found for {env}"

        for fixture in EXECUTORS:
            name = f"{fixture.name}-{env}"
            executor = ExecutorCreate(
                name=name,
                description=fixture.description,
                source_code_id=source_code[0].id,
                source_code_branch="main",
                source_code_folder=fixture.folder,
                storage_id=storages[0].id,
                storage_path=f"/executors/{env}/{fixture.name}/",
                command_args=f"-var-file=tfvars/{env}.tfvars",
                labels=[*fixture.labels, env],
            )
            await executor_service.create_executor(executor=executor, requester=user)

    await session.commit()
