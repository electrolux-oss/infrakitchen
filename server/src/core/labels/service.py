from .crud import LabelsCRUD


class LabelsService:
    def __init__(self, crud: LabelsCRUD):
        self.crud: LabelsCRUD = crud

    async def get_all_labels(self) -> list[str]:
        return await self.crud.aggregate_all_labels()

    async def get_labels(self, entity: str) -> list[str]:
        return await self.crud.get_labels(entity=entity)
