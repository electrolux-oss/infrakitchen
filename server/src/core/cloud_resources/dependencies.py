from .model import CloudResourceModel
from .controller import CloudResourcesCRUD


async def get_entities_crud() -> CloudResourcesCRUD:
    return CloudResourcesCRUD(entity_model=CloudResourceModel)
