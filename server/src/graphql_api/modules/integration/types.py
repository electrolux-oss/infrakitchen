import uuid
from datetime import datetime

import strawberry
from strawberry.scalars import JSON

from graphql_api.modules.user.types import UserType


@strawberry.type
class IntegrationType:
    id: uuid.UUID
    name: str
    description: str = ""
    integration_type: str = ""
    integration_provider: str = ""
    configuration: JSON | None = None
    labels: list[str] | None = None
    status: str = ""
    revision_number: int = 1
    created_by: uuid.UUID | None = None
    creator: UserType | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
