from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.constants.model import ModelStatus
from core.database import evaluate_sqlalchemy_pagination
from core.utils.model_tools import is_valid_uuid

from .model import ServiceBuild

ACTIVE_STATUSES = (ModelStatus.QUEUED, ModelStatus.IN_PROGRESS)


class ServiceBuildCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, build_id: str | UUID) -> ServiceBuild | None:
        if not is_valid_uuid(build_id):
            raise ValueError(f"Invalid UUID: {build_id}")
        result = await self.session.execute(select(ServiceBuild).where(ServiceBuild.id == build_id))
        return result.scalars().unique().first()

    async def get_by_service(
        self,
        service_id: str | UUID,
        commit_shas: list[str] | None = None,
        range: tuple[int, int] | None = None,
    ) -> list[ServiceBuild]:
        statement = select(ServiceBuild).where(ServiceBuild.service_id == service_id)
        if commit_shas is not None:
            statement = statement.where(ServiceBuild.commit_sha.in_(commit_shas))
        statement = statement.order_by(ServiceBuild.created_at.desc())
        statement = evaluate_sqlalchemy_pagination(statement, range)
        result = await self.session.execute(statement)
        return list(result.scalars().unique().all())

    async def count_by_service(self, service_id: str | UUID) -> int:
        statement = select(func.count()).select_from(ServiceBuild).where(ServiceBuild.service_id == service_id)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def has_active_build(self, service_id: str | UUID, commit_sha: str) -> bool:
        statement = select(ServiceBuild.id).where(
            ServiceBuild.service_id == service_id,
            ServiceBuild.commit_sha == commit_sha,
            ServiceBuild.status.in_(ACTIVE_STATUSES),
        )
        result = await self.session.execute(statement.limit(1))
        return result.scalar_one_or_none() is not None

    async def create(self, body: dict[str, Any]) -> ServiceBuild:
        build = ServiceBuild(**body)
        self.session.add(build)
        await self.session.flush()
        return build

    async def refresh(self, build: ServiceBuild) -> None:
        await self.session.refresh(build)
