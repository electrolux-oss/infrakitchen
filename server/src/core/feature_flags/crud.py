from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.feature_flags.model import FeatureFlag
from core.users.model import User


class FeatureFlagCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_name(self, name: str) -> FeatureFlag | None:
        statement = (
            select(FeatureFlag).where(FeatureFlag.name == name).outerjoin(User, FeatureFlag.updated_by == User.id)
        )

        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(self):
        statement = select(FeatureFlag)
        result = await self.session.execute(statement)
        return result.scalars().all()

    async def update(self, existing_feature_flag: FeatureFlag, body: dict[str, Any]) -> FeatureFlag:
        for key, value in body.items():
            setattr(existing_feature_flag, key, value)

        self.session.add(existing_feature_flag)
        await self.session.flush()
        return existing_feature_flag

    async def refresh(self, feature_flag: FeatureFlag) -> None:
        await self.session.refresh(feature_flag)

    async def delete(self, feature_flag: FeatureFlag) -> None:
        await self.session.delete(feature_flag)
