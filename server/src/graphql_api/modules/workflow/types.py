import uuid
from datetime import datetime

import strawberry
from strawberry.scalars import JSON

from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.resource.types import ResourceType
from graphql_api.modules.secret.types import SecretType
from graphql_api.modules.source_code_version.types import SourceCodeVersionType
from graphql_api.modules.template.types import TemplateType
from graphql_api.modules.user.types import UserType


@strawberry.type
class WorkflowStepType:
    id: uuid.UUID
    workflow_id: uuid.UUID
    template_id: uuid.UUID
    template: TemplateType | None = None
    resource_id: uuid.UUID | None = None
    resource: ResourceType | None = None
    source_code_version_id: uuid.UUID | None = None
    source_code_version: SourceCodeVersionType | None = None
    parent_resource_ids: JSON | None = None
    parent_resources: list[ResourceType] | None = None
    integration_ids: list[IntegrationType] | None = None
    secret_ids: list[SecretType] | None = None
    storage_id: uuid.UUID | None = None
    position: int = 0
    status: str = ""
    error_message: str | None = None
    resolved_variables: JSON | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


@strawberry.type
class WorkflowType:
    id: uuid.UUID
    action: str = "create"
    wiring_snapshot: JSON | None = None
    variable_overrides: JSON | None = None
    status: str = ""
    error_message: str | None = None
    created_by: uuid.UUID | None = None
    creator: UserType | None = None
    steps: list[WorkflowStepType] | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None
