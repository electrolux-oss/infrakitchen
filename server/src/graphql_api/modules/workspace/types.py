import uuid
from datetime import datetime

import strawberry
from strawberry.scalars import JSON

from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.user.types import UserType


@strawberry.type
class WorkspaceType:
    id: uuid.UUID
    name: str
    workspace_provider: str = ""
    integration_id: uuid.UUID | None = None
    integration: IntegrationType | None = None
    configuration: JSON | None = None
    status: str = ""
    description: str = ""
    labels: list[str] | None = None
    created_by: uuid.UUID | None = None
    creator: UserType | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
