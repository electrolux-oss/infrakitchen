from pydantic import BaseModel, Field


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
