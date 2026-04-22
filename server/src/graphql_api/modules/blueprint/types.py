import uuid
from datetime import datetime

import strawberry
from strawberry.scalars import JSON

from graphql_api.modules.template.types import TemplateType
from graphql_api.modules.user.types import UserType
from graphql_api.modules.workflow.types import WorkflowType


@strawberry.type
class BlueprintType:
    id: uuid.UUID
    name: str
    description: str | None = None
    templates: list[TemplateType] | None = None
    wiring: JSON | None = None
    default_variables: JSON | None = None
    configuration: JSON | None = None
    labels: list[str] | None = None
    status: str = ""
    revision_number: int = 1
    created_by: uuid.UUID | None = None
    creator: UserType | None = None
    workflows: list[WorkflowType] | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
