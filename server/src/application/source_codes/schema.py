from datetime import datetime
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from application.integrations.schema import IntegrationShort


from core.constants.model import ModelStatus
from core.users.schema import UserShort


class RefFolders(BaseModel):
    ref: str
    folders: list[str]


class SourceCodeResponse(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    status: Literal[
        ModelStatus.IN_PROGRESS,
        ModelStatus.DONE,
        ModelStatus.ERROR,
        ModelStatus.READY,
        ModelStatus.DISABLED,
    ] = Field(default=ModelStatus.READY)

    revision_number: int = Field(default=1)
    creator: UserShort = Field()
    labels: list[str] = Field(default_factory=list)

    description: str = Field(default="")
    source_code_url: str = Field(
        ...,
        frozen=True,
    )
    source_code_provider: Literal["github", "gitlab", "bitbucket", "azure_devops"] = Field(..., frozen=True)
    source_code_language: Literal["opentofu"] = Field(..., frozen=True)
    integration: IntegrationShort | None = Field(default=None)
    git_tags: list[str] = Field(default_factory=list)
    git_tag_messages: dict[str, str] | None = Field(default_factory=dict)
    git_branches: list[str] = Field(default_factory=list)
    git_branch_messages: dict[str, str] | None = Field(default_factory=dict)
    git_folders_map: list[RefFolders] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "source_code"

    @computed_field
    def identifier(self) -> str:
        return f"{self.source_code_provider} {self.source_code_language} {self.source_code_url}"


class SourceCodeCreate(BaseModel):
    description: str = Field(default="")
    source_code_url: str = Field(
        ...,
        frozen=True,
    )
    source_code_provider: Literal["github", "gitlab", "bitbucket", "azure_devops"] = Field(..., frozen=True)
    source_code_language: Literal["opentofu"] = Field(..., frozen=True)
    integration_id: str | uuid.UUID | None = Field(default=None)
    labels: list[str] = Field(default_factory=list)


class SourceCodeUpdate(BaseModel):
    description: str | None = Field(default=None)
    integration_id: str | uuid.UUID | None = Field(default=None, frozen=True)
    labels: list[str] = Field(default_factory=list)


class SourceCodeShort(BaseModel):
    """
    Short representation of a source code.
    """

    id: uuid.UUID
    source_code_url: str
    source_code_provider: Literal["github", "gitlab", "bitbucket", "azure_devops"]
    source_code_language: Literal["opentofu"]

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def identifier(self) -> str:
        return f"{self.source_code_provider} {self.source_code_language} {self.source_code_url}"

    @computed_field
    def _entity_name(self) -> str:
        return "source_code"
