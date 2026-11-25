from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .model import GeneralSettings


class GeneralSettingsCRUD:
    """The global general settings: one name/metadata row per setting."""

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_all(self) -> dict[str, Any]:
        rows = await self.session.scalars(select(GeneralSettings))
        return {row.name: row.setting_metadata for row in rows}

    async def upsert(self, values: dict[str, Any], updated_by: UUID | None) -> None:
        if not values:
            return
        stmt = insert(GeneralSettings).values(
            [{"name": name, "metadata": value, "updated_by": updated_by} for name, value in values.items()]
        )
        # ON CONFLICT keeps this safe when two admins save at the same time
        stmt = stmt.on_conflict_do_update(
            index_elements=[GeneralSettings.name],
            set_={"metadata": stmt.excluded.metadata, "updated_by": stmt.excluded.updated_by, "updated_at": func.now()},
        )
        _ = await self.session.execute(stmt)
