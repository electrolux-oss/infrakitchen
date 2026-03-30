import uuid
from datetime import datetime

import strawberry
from strawberry.scalars import JSON

from graphql_api.modules.source_code.types import SourceCodeType
from graphql_api.modules.template.types import TemplateType
from graphql_api.modules.user.types import UserType


@strawberry.type
class SourceConfigType:
    id: uuid.UUID
    index: int = 0
    required: bool = False
    default: JSON | None = None
    frozen: bool = False
    unique: bool = False
    sensitive: bool = False
    restricted: bool = False
    name: str = ""
    description: str = ""
    type: str = ""
    options: list[str] | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@strawberry.type
class SourceOutputConfigType:
    id: uuid.UUID
    index: int = 0
    name: str = ""
    description: str = ""
    created_at: datetime | None = None
    updated_at: datetime | None = None


@strawberry.type
class SourceCodeVersionType:
    id: uuid.UUID
    template_id: uuid.UUID | None = None
    template: TemplateType | None = None
    source_code_id: uuid.UUID | None = None
    source_code: SourceCodeType | None = None
    source_code_version: str | None = None
    source_code_branch: str | None = None
    source_code_folder: str = ""
    variables: JSON | None = None
    outputs: JSON | None = None
    description: str = ""
    labels: list[str] | None = None
    status: str = ""
    revision_number: int = 1
    variable_configs: list[SourceConfigType] | None = None
    output_configs: list[SourceOutputConfigType] | None = None
    created_by: uuid.UUID | None = None
    creator: UserType | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
