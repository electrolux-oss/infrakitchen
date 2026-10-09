from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration
from core.constants.model import ModelStatus
from core.database import evaluate_sqlalchemy_pagination

from .model import IacEnvironmentConfig, IacRun

ACTIVE_RUN_STATUSES = (ModelStatus.QUEUED, ModelStatus.IN_PROGRESS)


class IacCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    # Environment configs

    async def get_environment_config(self, config_id: str | UUID) -> IacEnvironmentConfig | None:
        return await self.session.get(IacEnvironmentConfig, config_id)

    async def get_environment_config_by_name(
        self, source_code_id: str | UUID, name: str
    ) -> IacEnvironmentConfig | None:
        result = await self.session.execute(
            select(IacEnvironmentConfig).where(
                IacEnvironmentConfig.source_code_id == source_code_id, IacEnvironmentConfig.name == name
            )
        )
        return result.scalar_one_or_none()

    async def get_environment_configs(self, source_code_id: str | UUID) -> list[IacEnvironmentConfig]:
        result = await self.session.execute(
            select(IacEnvironmentConfig)
            .where(IacEnvironmentConfig.source_code_id == source_code_id)
            .order_by(IacEnvironmentConfig.name)
        )
        return list(result.scalars().all())

    async def get_integrations(self, integration_ids: list[UUID]) -> list[Integration]:
        if not integration_ids:
            return []
        result = await self.session.execute(select(Integration).where(Integration.id.in_(integration_ids)))
        return list(result.scalars().all())

    async def create_environment_config(self, body: dict[str, Any]) -> IacEnvironmentConfig:
        config = IacEnvironmentConfig(**body)
        self.session.add(config)
        await self.session.flush()
        return config

    async def delete_environment_config(self, config: IacEnvironmentConfig) -> None:
        await self.session.delete(config)

    # Runs

    async def get_run(self, run_id: str | UUID) -> IacRun | None:
        return await self.session.get(IacRun, run_id)

    async def create_run(self, body: dict[str, Any]) -> IacRun:
        run = IacRun(**body)
        self.session.add(run)
        await self.session.flush()
        return run

    @staticmethod
    def _run_condition(
        source_code_id: str | UUID,
        module_path: str | None,
        environment_name: str | None,
        region: str | None = None,
    ) -> Any:
        condition = IacRun.source_code_id == source_code_id
        if module_path is not None:
            condition = condition & (IacRun.module_path == module_path)
        if environment_name is not None:
            condition = condition & (IacRun.environment_name == environment_name)
        if region is not None:
            condition = condition & (IacRun.region == region)
        return condition

    async def get_runs(
        self,
        source_code_id: str | UUID,
        module_path: str | None = None,
        environment_name: str | None = None,
        region: str | None = None,
        range: tuple[int, int] | None = None,
    ) -> list[IacRun]:
        """Runs, newest first; of one module, environment and/or region when given."""
        statement = (
            select(IacRun)
            .where(self._run_condition(source_code_id, module_path, environment_name, region))
            .order_by(IacRun.created_at.desc())
        )
        statement = evaluate_sqlalchemy_pagination(statement, range)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count_runs(
        self,
        source_code_id: str | UUID,
        module_path: str | None = None,
        environment_name: str | None = None,
        region: str | None = None,
    ) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(IacRun)
            .where(self._run_condition(source_code_id, module_path, environment_name, region))
        )
        return result.scalar_one() or 0

    async def get_latest_runs(self, source_code_id: str | UUID) -> list[IacRun]:
        """The newest run of every module, environment and region of a repository."""
        newest = (
            select(
                IacRun.id,
                func.row_number()
                .over(
                    partition_by=(IacRun.module_path, IacRun.environment_name, IacRun.region),
                    order_by=IacRun.created_at.desc(),
                )
                .label("rank"),
            )
            .where(IacRun.source_code_id == source_code_id)
            .subquery()
        )
        result = await self.session.execute(
            select(IacRun).join(newest, newest.c.id == IacRun.id).where(newest.c.rank == 1)
        )
        return list(result.scalars().all())

    async def get_active_run(
        self, source_code_id: str | UUID, module_path: str, environment_name: str, region: str | None
    ) -> IacRun | None:
        region_condition = IacRun.region.is_(None) if region is None else IacRun.region == region
        result = await self.session.execute(
            select(IacRun)
            .where(
                self._run_condition(source_code_id, module_path, environment_name),
                region_condition,
                IacRun.status.in_(ACTIVE_RUN_STATUSES),
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def refresh(self, entity: IacRun | IacEnvironmentConfig) -> None:
        await self.session.refresh(entity)
