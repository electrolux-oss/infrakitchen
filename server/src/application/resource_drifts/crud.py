from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .model import DRIFT_SETTINGS_ID, DriftSettings, ResourceDrift


class ResourceDriftCRUD:
    """Data access of the drift results; what a check changes is decided by ResourceDriftService."""

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_resource_id(self, resource_id: UUID) -> ResourceDrift | None:
        return await self.session.scalar(select(ResourceDrift).where(ResourceDrift.resource_id == resource_id))

    async def get_by_resource_ids(self, resource_ids: Sequence[UUID | str]) -> list[ResourceDrift]:
        result = await self.session.execute(select(ResourceDrift).where(ResourceDrift.resource_id.in_(resource_ids)))
        return list(result.scalars().all())

    async def create(self, body: dict[str, Any]) -> ResourceDrift:
        drift = ResourceDrift(**body)
        self.session.add(drift)
        await self.session.flush()
        return drift

    async def update(self, drift: ResourceDrift, body: dict[str, Any]) -> ResourceDrift:
        for key, value in body.items():
            setattr(drift, key, value)
        await self.session.flush()
        return drift

    async def delete_by_resource_id(self, resource_id: UUID) -> None:
        _ = await self.session.execute(delete(ResourceDrift).where(ResourceDrift.resource_id == resource_id))


class DriftSettingsCRUD:
    """The global drift settings: a single row with a fixed id, created on the first save."""

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get(self) -> DriftSettings | None:
        return await self.session.get(DriftSettings, DRIFT_SETTINGS_ID)

    async def get_or_create(self) -> DriftSettings:
        # insert-if-missing keeps a single row even when two admins save the first settings at the same time
        _ = await self.session.execute(
            insert(DriftSettings).values(id=DRIFT_SETTINGS_ID).on_conflict_do_nothing(index_elements=[DriftSettings.id])
        )
        row = await self.get()
        if row is None:
            raise RuntimeError("Drift settings row was not created")
        return row

    async def update(self, row: DriftSettings, body: dict[str, Any]) -> DriftSettings:
        for key, value in body.items():
            setattr(row, key, value)
        await self.session.flush()
        # updated_at is set by the database
        await self.session.refresh(row)
        return row
