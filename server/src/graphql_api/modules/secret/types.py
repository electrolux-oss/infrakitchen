import uuid
from datetime import datetime

import strawberry

from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.user.types import UserType


@strawberry.type
class SecretType:
    id: uuid.UUID
    name: str
    secret_type: str = ""
    secret_provider: str = ""
    integration_id: uuid.UUID | None = None
    integration: IntegrationType | None = None
    description: str = ""
    labels: list[str] | None = None
    state: str = ""
    status: str = ""
    revision_number: int = 1
    created_by: uuid.UUID | None = None
    creator: UserType | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
