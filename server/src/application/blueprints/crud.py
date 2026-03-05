from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.users.model import User
from core.utils.model_tools import is_valid_uuid

from .model import Blueprint, blueprint_templates


class BlueprintCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, blueprint_id: str | UUID) -> Blueprint | None:
        if not is_valid_uuid(blueprint_id):
            raise ValueError(f"Invalid UUID: {blueprint_id}")

        statement = (
            select(Blueprint)
            .where(Blueprint.id == blueprint_id)
            .join(User, Blueprint.created_by == User.id)
            .options(selectinload(Blueprint.templates))
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Blueprint]:
        statement = select(Blueprint)
        statement = evaluate_sqlalchemy_filters(Blueprint, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Blueprint, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        statement = statement.options(selectinload(Blueprint.templates)).join(User, Blueprint.created_by == User.id)
        result = await self.session.execute(statement)
        return list(result.scalars().unique().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Blueprint)
        statement = evaluate_sqlalchemy_filters(Blueprint, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def create(self, data: dict[str, Any]) -> Blueprint:
        template_ids = data.pop("template_ids", [])
        blueprint = Blueprint(**data)
        self.session.add(blueprint)
        await self.session.flush()

        # Insert association rows with position
        for position, template_id in enumerate(template_ids):
            await self.session.execute(
                blueprint_templates.insert().values(
                    blueprint_id=blueprint.id,
                    template_id=template_id,
                    position=position,
                )
            )
        await self.session.flush()
        # Re-fetch with selectinload so the templates relationship is populated
        return await self.get_by_id(blueprint.id)

    async def update(self, blueprint_id: str | UUID, data: dict[str, Any]) -> Blueprint | None:
        blueprint = await self.get_by_id(blueprint_id)
        if blueprint is None:
            return None

        template_ids = data.pop("template_ids", None)
        for key, value in data.items():
            if hasattr(blueprint, key):
                setattr(blueprint, key, value)

        if template_ids is not None:
            # Replace template associations
            await self.session.execute(
                blueprint_templates.delete().where(blueprint_templates.c.blueprint_id == blueprint.id)
            )
            for position, template_id in enumerate(template_ids):
                await self.session.execute(
                    blueprint_templates.insert().values(
                        blueprint_id=blueprint.id,
                        template_id=template_id,
                        position=position,
                    )
                )

        await self.session.flush()
        return await self.get_by_id(blueprint_id)

    async def delete(self, blueprint_id: str | UUID) -> None:
        blueprint = await self.get_by_id(blueprint_id)
        if blueprint:
            await self.session.delete(blueprint)
            await self.session.flush()
