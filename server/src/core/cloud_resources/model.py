from pydantic import BaseModel, computed_field


class CloudResourceModel(BaseModel):
    id: str
    provider: str
    name: str

    @computed_field
    def _entity_name(self) -> str:
        return "cloud_resource"
