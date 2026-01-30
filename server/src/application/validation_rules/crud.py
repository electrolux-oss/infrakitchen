from collections.abc import Sequence

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import ValidationRule


class ValidationRuleCRUD:
    """Data access helper for validation rules."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_rules(self, entity_name: str | None = None) -> Sequence[ValidationRule]:
        """Return validation rules optionally filtered by entity."""
        statement: Select[tuple[ValidationRule]] = select(ValidationRule)
        if entity_name:
            statement = statement.where(ValidationRule.entity_name == entity_name)
        statement = statement.order_by(ValidationRule.entity_name.asc(), ValidationRule.field_path.asc())

        result = await self.session.execute(statement)
        return list(result.scalars().all())
