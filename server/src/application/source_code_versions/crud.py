from typing import Any
from uuid import UUID

from sqlalchemy import func, literal, select, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from application.templates.model import Template
from application.resources.model import Resource
from application.source_codes.model import SourceCode
from core.users.model import User

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.utils.model_tools import is_valid_uuid

from .model import SourceCodeVersion, SourceConfig, SourceOutputConfig


class SourceCodeVersionCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, source_code_version_id: str | UUID) -> SourceCodeVersion | None:
        if not is_valid_uuid(source_code_version_id):
            raise ValueError(f"Invalid UUID: {source_code_version_id}")

        statement = (
            (
                select(SourceCodeVersion)
                .where(SourceCodeVersion.id == source_code_version_id)
                .join(User, SourceCodeVersion.created_by == User.id)
            )
            .join(Template, SourceCodeVersion.template_id == Template.id)
            .join(SourceCode, SourceCodeVersion.source_code_id == SourceCode.id)
        )
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[SourceCodeVersion]:
        statement = (
            select(SourceCodeVersion)
            .join(User, SourceCodeVersion.created_by == User.id)
            .join(Template, SourceCodeVersion.template_id == Template.id)
            .join(SourceCode, SourceCodeVersion.source_code_id == SourceCode.id)
        )

        statement = evaluate_sqlalchemy_filters(SourceCodeVersion, statement, filter)
        statement = evaluate_sqlalchemy_sorting(SourceCodeVersion, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        result = await self.session.execute(statement)
        return list(result.unique().scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(SourceCodeVersion)
        statement = evaluate_sqlalchemy_filters(SourceCodeVersion, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> SourceCodeVersion:
        db_source_code_version = SourceCodeVersion(**body)
        self.session.add(db_source_code_version)
        await self.session.flush()
        return db_source_code_version

    async def update(self, existing_source_code_version: SourceCodeVersion, body: dict[str, Any]) -> SourceCodeVersion:
        for key, value in body.items():
            setattr(existing_source_code_version, key, value)
        return existing_source_code_version

    async def delete(self, source_code_version: SourceCodeVersion) -> None:
        statement = select(SourceConfig).where(SourceConfig.source_code_version_id == source_code_version.id)
        result = await self.session.execute(statement)
        configs = result.scalars().all()
        for config in configs:
            await self.session.delete(config)

        statement = select(SourceOutputConfig).where(
            SourceOutputConfig.source_code_version_id == source_code_version.id
        )
        result = await self.session.execute(statement)
        outputs = result.scalars().all()
        for output in outputs:
            await self.session.delete(output)
        await self.session.delete(source_code_version)

    async def get_dependencies(self, existing_source_code_version: SourceCodeVersion) -> list[Any]:
        statement = select(
            Resource.id.label("id"), literal("resource").label("type"), Resource.name.label("name")
        ).where(Resource.source_code_version_id == existing_source_code_version.id)
        result = await self.session.execute(statement)
        return list(result.fetchall())

    async def refresh(self, source_code_version: SourceCodeVersion | SourceConfig) -> None:
        await self.session.refresh(source_code_version)

    # Variable Configs ant Output Configs
    async def get_configs_by_scv_id(self, source_code_version_id: str | UUID) -> list[SourceConfig]:
        statement = (
            select(SourceConfig)
            .where(SourceConfig.source_code_version_id == source_code_version_id)
            .order_by(SourceConfig.index.asc())
        )
        result = await self.session.execute(statement)
        return list(result.unique().scalars().all())

    async def get_config_by_id(self, source_code_config_id: str | UUID) -> SourceConfig | None:
        statement = select(SourceConfig).where(SourceConfig.id == source_code_config_id)
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def create_config(self, body: dict[str, Any]) -> SourceConfig:
        db_source_code_config = SourceConfig(**body)
        self.session.add(db_source_code_config)
        await self.session.flush()
        return db_source_code_config

    async def update_config(self, existing_source_code_config: SourceConfig, body: dict[str, Any]) -> SourceConfig:
        for key, value in body.items():
            setattr(existing_source_code_config, key, value)
        return existing_source_code_config

    async def get_output_by_scv_id(self, source_code_version_id: str | UUID) -> list[SourceOutputConfig]:
        statement = select(SourceOutputConfig).where(
            SourceOutputConfig.source_code_version_id == source_code_version_id
        )
        result = await self.session.execute(statement)
        return list(result.unique().scalars().all())

    async def create_output_config(self, body: dict[str, Any]) -> SourceOutputConfig:
        db_source_code_output = SourceOutputConfig(**body)
        self.session.add(db_source_code_output)
        await self.session.flush()
        return db_source_code_output

    async def get_scvs_with_configs_and_outputs(self, source_code_version_ids: list[UUID]) -> list[SourceCodeVersion]:
        if len(source_code_version_ids) == 0:
            return []

        statement = (
            select(SourceCodeVersion)
            .outerjoin(SourceConfig, SourceConfig.source_code_version_id == SourceCodeVersion.id)
            .outerjoin(SourceOutputConfig, SourceOutputConfig.source_code_version_id == SourceCodeVersion.id)
            .where(SourceCodeVersion.id.in_(source_code_version_ids))
            .options(selectinload(SourceCodeVersion.variable_configs), selectinload(SourceCodeVersion.output_configs))
        )

        order_case = case({id_: index for index, id_ in enumerate(source_code_version_ids)}, value=SourceCodeVersion.id)
        statement = statement.order_by(order_case)
        result = await self.session.execute(statement)
        return list(result.unique().scalars().all())

    async def get_by_id_with_configs(self, source_code_version_id: str | UUID) -> SourceCodeVersion | None:
        if not is_valid_uuid(source_code_version_id):
            raise ValueError(f"Invalid UUID: {source_code_version_id}")

        statement = (
            select(SourceCodeVersion)
            .where(SourceCodeVersion.id == source_code_version_id)
            .options(
                joinedload(SourceCodeVersion.template),
                joinedload(SourceCodeVersion.source_code),
                selectinload(SourceCodeVersion.variable_configs),
                selectinload(SourceCodeVersion.output_configs),
            )
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()
