import re
import uuid
from pydantic import BaseModel, ConfigDict, Field, field_validator


class TemplateCreateWithSCV(BaseModel):
    """
    MVP For creating a template with a single cloud resource version
    children, parents, labels and cloud_resource_types are not needed
    """

    name: str = Field(...)
    description: str = Field(default="")
    source_code_branch: str = Field(default="main")
    source_code_url: str = Field(...)
    source_code_folder: str = Field(default="/")
    integration_id: str | uuid.UUID | None = Field(default=None)
    source_code_language: str = Field(default="Terraform")
    labels: list[str] = Field(default=[])
    parents: list[uuid.UUID] = Field(default=[])

    model_config = ConfigDict(from_attributes=True)

    @field_validator("source_code_url")
    @classmethod
    def validate_repository(cls, value: str) -> str:
        pattern = r"^(https:\/\/|git@)([\w\.@]+)(\/|:)([\w,\-,_,\/]+)(\.git)?$"
        if not re.fullmatch(pattern, value):
            raise ValueError(f"field has to match pattern {pattern}")
        return value
