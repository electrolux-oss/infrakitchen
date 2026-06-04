from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader

from application.resources.model import Resource, resource_integrations, resource_secrets
from application.executors.model import Executor, executor_integrations, executor_secrets
from application.source_codes.model import SourceCode
from application.source_code_versions.model import SourceCodeVersion
from application.workspaces.model import Workspace


async def _count_resources_by_integration(keys: list[str], session: AsyncSession) -> list[int]:
    stmt = (
        select(resource_integrations.c.integration_id, func.count())
        .where(resource_integrations.c.integration_id.in_(keys))
        .group_by(resource_integrations.c.integration_id)
    )
    result = await session.execute(stmt)
    mapping = {str(row[0]): row[1] for row in result}
    return [mapping.get(key, 0) for key in keys]


async def _count_source_codes_by_integration(keys: list[str], session: AsyncSession) -> list[int]:
    stmt = (
        select(SourceCode.integration_id, func.count())
        .where(SourceCode.integration_id.in_(keys))
        .group_by(SourceCode.integration_id)
    )
    result = await session.execute(stmt)
    mapping = {str(row[0]): row[1] for row in result}
    return [mapping.get(key, 0) for key in keys]


async def _count_workspaces_by_integration(keys: list[str], session: AsyncSession) -> list[int]:
    stmt = (
        select(Workspace.integration_id, func.count())
        .where(Workspace.integration_id.in_(keys))
        .group_by(Workspace.integration_id)
    )
    result = await session.execute(stmt)
    mapping = {str(row[0]): row[1] for row in result}
    return [mapping.get(key, 0) for key in keys]


async def _count_resources_by_workspace(keys: list[str], session: AsyncSession) -> list[int]:
    stmt = (
        select(Resource.workspace_id, func.count())
        .where(Resource.workspace_id.in_(keys))
        .group_by(Resource.workspace_id)
    )
    result = await session.execute(stmt)
    mapping = {str(row[0]): row[1] for row in result}
    return [mapping.get(key, 0) for key in keys]


async def _count_resources_by_storage(keys: list[str], session: AsyncSession) -> list[int]:
    stmt = select(Resource.storage_id, func.count()).where(Resource.storage_id.in_(keys)).group_by(Resource.storage_id)
    result = await session.execute(stmt)
    mapping = {str(row[0]): row[1] for row in result}
    return [mapping.get(key, 0) for key in keys]


async def _count_resources_by_template(keys: list[str], session: AsyncSession) -> list[int]:
    stmt = (
        select(Resource.template_id, func.count()).where(Resource.template_id.in_(keys)).group_by(Resource.template_id)
    )
    result = await session.execute(stmt)
    mapping = {str(row[0]): row[1] for row in result}
    return [mapping.get(key, 0) for key in keys]


async def _count_source_code_versions_by_template(keys: list[str], session: AsyncSession) -> list[int]:
    stmt = (
        select(SourceCodeVersion.template_id, func.count())
        .where(SourceCodeVersion.template_id.in_(keys))
        .group_by(SourceCodeVersion.template_id)
    )
    result = await session.execute(stmt)
    mapping = {str(row[0]): row[1] for row in result}
    return [mapping.get(key, 0) for key in keys]


async def _count_resources_by_source_code_version(keys: list[str], session: AsyncSession) -> list[int]:
    stmt = (
        select(Resource.source_code_version_id, func.count())
        .where(Resource.source_code_version_id.in_(keys))
        .group_by(Resource.source_code_version_id)
    )
    result = await session.execute(stmt)
    mapping = {str(row[0]): row[1] for row in result}
    return [mapping.get(key, 0) for key in keys]


async def _count_resources_by_secret(keys: list[str], session: AsyncSession) -> list[int]:
    stmt = (
        select(resource_secrets.c.secret_id, func.count())
        .where(resource_secrets.c.secret_id.in_(keys))
        .group_by(resource_secrets.c.secret_id)
    )
    result = await session.execute(stmt)
    mapping = {str(row[0]): row[1] for row in result}
    return [mapping.get(key, 0) for key in keys]


async def _count_executors_by_storage(keys: list[str], session: AsyncSession) -> list[int]:
    stmt = select(Executor.storage_id, func.count()).where(Executor.storage_id.in_(keys)).group_by(Executor.storage_id)
    result = await session.execute(stmt)
    mapping = {str(row[0]): row[1] for row in result}
    return [mapping.get(key, 0) for key in keys]


async def _count_executors_by_integration(keys: list[str], session: AsyncSession) -> list[int]:
    stmt = (
        select(executor_integrations.c.integration_id, func.count())
        .where(executor_integrations.c.integration_id.in_(keys))
        .group_by(executor_integrations.c.integration_id)
    )
    result = await session.execute(stmt)
    mapping = {str(row[0]): row[1] for row in result}
    return [mapping.get(key, 0) for key in keys]


async def _count_executors_by_secret(keys: list[str], session: AsyncSession) -> list[int]:
    stmt = (
        select(executor_secrets.c.secret_id, func.count())
        .where(executor_secrets.c.secret_id.in_(keys))
        .group_by(executor_secrets.c.secret_id)
    )
    result = await session.execute(stmt)
    mapping = {str(row[0]): row[1] for row in result}
    return [mapping.get(key, 0) for key in keys]


def count_loaders(session: AsyncSession) -> dict[str, DataLoader[str, int]]:
    return {
        "integration_resource_count": DataLoader[str, int](
            load_fn=lambda keys: _count_resources_by_integration(list(keys), session)
        ),
        "integration_source_code_count": DataLoader[str, int](
            load_fn=lambda keys: _count_source_codes_by_integration(list(keys), session)
        ),
        "integration_workspace_count": DataLoader[str, int](
            load_fn=lambda keys: _count_workspaces_by_integration(list(keys), session)
        ),
        "workspace_resource_count": DataLoader[str, int](
            load_fn=lambda keys: _count_resources_by_workspace(list(keys), session)
        ),
        "storage_resource_count": DataLoader[str, int](
            load_fn=lambda keys: _count_resources_by_storage(list(keys), session)
        ),
        "template_resource_count": DataLoader[str, int](
            load_fn=lambda keys: _count_resources_by_template(list(keys), session)
        ),
        "template_source_code_version_count": DataLoader[str, int](
            load_fn=lambda keys: _count_source_code_versions_by_template(list(keys), session)
        ),
        "source_code_version_resource_count": DataLoader[str, int](
            load_fn=lambda keys: _count_resources_by_source_code_version(list(keys), session)
        ),
        "secret_resource_count": DataLoader[str, int](
            load_fn=lambda keys: _count_resources_by_secret(list(keys), session)
        ),
        "storage_executor_count": DataLoader[str, int](
            load_fn=lambda keys: _count_executors_by_storage(list(keys), session)
        ),
        "integration_executor_count": DataLoader[str, int](
            load_fn=lambda keys: _count_executors_by_integration(list(keys), session)
        ),
        "secret_executor_count": DataLoader[str, int](
            load_fn=lambda keys: _count_executors_by_secret(list(keys), session)
        ),
    }
