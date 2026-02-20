import uuid

from pydantic import BaseModel, Field

from .model import FavoriteComponentType


class FavoriteCreate(BaseModel):
    component_type: FavoriteComponentType = Field(...)
    component_id: uuid.UUID = Field(...)
