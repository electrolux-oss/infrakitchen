import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import DriftSettings, DriftSettingsDTO


async def get_drift_settings(session: AsyncSession) -> DriftSettingsDTO:
    """Global drift settings; drift detection is off until an admin enables it."""
    row = await session.scalar(select(DriftSettings).limit(1))
    return DriftSettingsDTO.model_validate(row) if row else DriftSettingsDTO()


async def update_drift_settings(
    session: AsyncSession, settings: DriftSettingsDTO, requester_id: uuid.UUID
) -> DriftSettingsDTO:
    row = await session.scalar(select(DriftSettings).limit(1))
    if row is None:
        row = DriftSettings()
        session.add(row)
    row.enabled = settings.enabled
    row.interval_hours = settings.interval_hours
    row.batch_size = settings.batch_size
    row.updated_by = requester_id
    await session.flush()
    await session.refresh(row)
    return DriftSettingsDTO.model_validate(row)
