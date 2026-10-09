from datetime import datetime, UTC
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from application.integrations.schema import IntegrationShort
from application.source_codes.iac import IacModule


from application.types import CodeLanguageType, GitProviderType, RepositoryType
from core.constants.model import ModelStatus
from core.users.schema import UserShort


class RefFolders(BaseModel):
    ref: str
    folders: list[str]


class SourceCodeResponse(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
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
    source_code_provider: GitProviderType = Field(..., frozen=True)
    source_code_language: CodeLanguageType = Field(..., frozen=True)
    repository_type: RepositoryType = Field(default="module_library")
    integration: IntegrationShort | None = Field(default=None)
    git_tags: list[str] = Field(default_factory=list)
    git_tag_messages: dict[str, str] | None = Field(default_factory=dict)
    git_branches: list[str] = Field(default_factory=list)
    git_branch_messages: dict[str, str] | None = Field(default_factory=dict)
    git_folders_map: list[RefFolders] = Field(default_factory=list)
    default_branch: str | None = Field(default=None)
    git_tag_shas: dict[str, str] | None = Field(default=None)
    iac_modules: list[IacModule] | None = Field(default=None)

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
    source_code_provider: GitProviderType = Field(..., frozen=True)
    source_code_language: CodeLanguageType = Field(..., frozen=True)
    repository_type: RepositoryType = Field(default="module_library")
    integration_id: str | uuid.UUID | None = Field(default=None)
    labels: list[str] = Field(default_factory=list)


class SourceCodeUpdate(BaseModel):
    description: str | None = Field(default=None)
    repository_type: RepositoryType | None = Field(default=None)
    integration_id: str | uuid.UUID | None = Field(default=None, frozen=True)
    labels: list[str] | None = Field(default=None)

    @model_validator(mode="before")
    @classmethod
    def at_least_one_field_present(cls, values):
        if not isinstance(values, dict):
            return values
        if not any(values.get(field) not in (None, [], "") for field in SourceCodeUpdate.model_fields):
            raise ValueError("At least one field must be provided in Source Code update.")
        return values


class SourceCodeCommitResponse(BaseModel):
    sha: str
    short_sha: str
    message: str
    description: str = Field(default="")
    author_name: str
    author_email: str
    authored_at: datetime
    url: str | None = Field(default=None)
    author: UserShort | None = Field(default=None)


class SourceCodeShort(BaseModel):
    """
    Short representation of a source code.
    """

    id: uuid.UUID
    source_code_url: str
    source_code_provider: GitProviderType
    source_code_language: CodeLanguageType

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def identifier(self) -> str:
        return f"{self.source_code_provider} {self.source_code_language} {self.source_code_url}"

    @computed_field
    def _entity_name(self) -> str:
        return "source_code"
