from typing import Annotated
import uuid

from pydantic import BaseModel, BeforeValidator, Field

# empty string from forms means "no value"
OptionalUUID = Annotated[None | uuid.UUID, BeforeValidator(lambda v: None if v == "" else v)]


class DependencyTag(BaseModel):
    """
    Used for tagging resources in cloud providers
    """

    name: str = Field(..., frozen=True)
    value: str = Field(..., frozen=True)
    inherited_by_children: bool = Field(default=False)


class DependencyConfig(BaseModel):
    """
    Used for sharing configs to children
    """

    name: str = Field(..., frozen=True)
    value: str = Field(..., frozen=True)
    inherited_by_children: bool = Field(default=False)
