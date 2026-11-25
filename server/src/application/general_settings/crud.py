from typing import Any

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .model import DEFAULT_BANNER_COLOR, GENERAL_SETTINGS_ID, GeneralSettings


class GeneralSettingsCRUD:
    """The global general settings: a single row with a fixed id, created on the first save."""

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get(self) -> GeneralSettings | None:
        return await self.session.get(GeneralSettings, GENERAL_SETTINGS_ID)

    async def get_or_create(self) -> GeneralSettings:
        # insert-if-missing keeps a single row even when two admins save the first settings at the same time
        _ = await self.session.execute(
            insert(GeneralSettings)
            .values(
                id=GENERAL_SETTINGS_ID,
                name="",
                banner_enabled=False,
                banner_message="",
                banner_color=DEFAULT_BANNER_COLOR,
            )
            .on_conflict_do_nothing(index_elements=[GeneralSettings.id])
        )
        row = await self.get()
        if row is None:
            raise RuntimeError("General settings row was not created")
        return row

    async def update(self, row: GeneralSettings, body: dict[str, Any]) -> GeneralSettings:
        for key, value in body.items():
            setattr(row, key, value)
        await self.session.flush()
        # updated_at is set by the database
        await self.session.refresh(row)
        return row
