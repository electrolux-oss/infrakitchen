import strawberry
from strawberry.types import Info

from core.labels.crud import LabelsCRUD
from core.labels.service import LabelsService
from core.utils.entities import get_all_entities
from graphql_api.helpers import IsAuthenticated


@strawberry.type
class LabelQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def labels(self, info: Info, entity: str | None = None) -> list[str]:
        """Return labels globally or for a single entity."""
        session = info.context["session"]
        service = LabelsService(LabelsCRUD(session))

        supported_entities = get_all_entities()
        if entity is None:
            return supported_entities

        if entity not in supported_entities:
            raise ValueError("Entity not supported")

        return await service.get_labels(entity=entity)
