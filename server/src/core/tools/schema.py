from datetime import datetime, UTC
import re
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from core.constants.model import ModelStatus
from core.users.schema import UserShort

type ToolName = Literal["opentofu", "terraform"]
type ToolOS = Literal["linux", "darwin"]
type ToolArch = Literal["amd64", "arm64"]

VERSION_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$")


class ToolShort(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(...)
    version: str = Field(...)
    os: str = Field(...)
    arch: str = Field(...)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "tool"


class ToolResponse(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(...)
    version: str = Field(...)
    os: str = Field(...)
    arch: str = Field(...)
    executable: str = Field(...)
    source_url: str = Field(default="")
    sha256: str = Field(default="")
    size: int = Field(default=0)
    status: Literal[
        ModelStatus.QUEUED,
        ModelStatus.IN_PROGRESS,
        ModelStatus.DONE,
        ModelStatus.ERROR,
        ModelStatus.DISABLED,
    ] = Field(default=ModelStatus.QUEUED)
    error_message: str = Field(default="")
    is_default: bool = Field(default=False)
    creator: UserShort | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "tool"


class ToolDownloadRequest(BaseModel):
    name: ToolName = Field(..., description="Tool to download")
    version: str = Field(..., description="Release version, e.g. 1.8.2")
    os: ToolOS = Field(default="linux")
    # defaults to the architecture of the host serving the request
    arch: ToolArch | None = Field(default=None)

    @field_validator("version")
    @classmethod
    def validate_version(cls, version: str) -> str:
        version = version.strip().removeprefix("v")
        if not VERSION_RE.match(version):
            raise ValueError(f"Invalid version: {version!r}")
        return version
