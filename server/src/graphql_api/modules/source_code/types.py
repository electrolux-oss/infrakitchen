import uuid
from datetime import datetime

import strawberry

from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.user.types import UserType


@strawberry.type
class SourceCodeType:
    id: uuid.UUID
    description: str | None = None
    source_code_url: str = ""
    source_code_provider: str = ""
    source_code_language: str = ""
    integration_id: uuid.UUID | None = None
    integration: IntegrationType | None = None
    git_tags: list[str] | None = None
    git_branches: list[str] | None = None
    labels: list[str] | None = None
    status: str = ""
    revision_number: int = 1
    created_by: uuid.UUID | None = None
    creator: UserType | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
