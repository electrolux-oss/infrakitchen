import strawberry
from strawberry.types import Info

from core.labels.crud import LabelsCRUD
from core.labels.service import LabelsService
from core.utils.entities import get_all_entities
from graphql_api.helpers import IsAuthenticated, check_api_permission


@strawberry.type
class LabelQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def labels(self, info: Info, entity: str | None = None) -> list[str]:
        """Return labels globally or for a single entity."""
        await check_api_permission(info, "label", ["read"])
        session = info.context["session"]
        service = LabelsService(LabelsCRUD(session))

        supported_entities = get_all_entities()
        if entity is None:
            return supported_entities

        if entity not in supported_entities:
            raise ValueError("Entity not supported")

        return await service.get_labels(entity=entity)
