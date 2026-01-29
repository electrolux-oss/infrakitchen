from core.caches.functions import cache_decorator

from .crud import ValidationRuleCRUD
from .schema import ValidationRuleResponse


class ValidationRuleService:
    """Provides read access to validation rules via the CRUD helper."""

    def __init__(self, crud: ValidationRuleCRUD):
        self.crud = crud

    @cache_decorator(ttl=300)
    async def list_rules(self, entity_name: str | None = None) -> list[ValidationRuleResponse]:
        """Return validation rules filtered by entity name (if provided)."""
        rules = await self.crud.list_rules(entity_name=entity_name)
        return [ValidationRuleResponse.model_validate(rule) for rule in rules]
