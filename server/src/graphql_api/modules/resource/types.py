import uuid
from datetime import datetime

import strawberry
from strawberry.scalars import JSON

from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.secret.types import SecretType
from graphql_api.modules.source_code_version.types import SourceCodeVersionType
from graphql_api.modules.storage.types import StorageType
from graphql_api.modules.template.types import TemplateType
from graphql_api.modules.user.types import UserType
from graphql_api.modules.workspace.types import WorkspaceType


@strawberry.type
class ResourceType:
    id: uuid.UUID | None = None
    name: str | None = None
    description: str | None = None
    template_id: uuid.UUID | None = None
    template: TemplateType | None = None
    source_code_version_id: uuid.UUID | None = None
    source_code_version: SourceCodeVersionType | None = None
    integration_ids: list[IntegrationType] | None = None
    secret_ids: list[SecretType] | None = None
    storage_id: uuid.UUID | None = None
    storage: StorageType | None = None
    storage_path: str | None = None
    variables: JSON | None = None
    outputs: JSON | None = None
    dependency_tags: JSON | None = None
    dependency_config: JSON | None = None
    parents: list["ResourceType"] | None = None
    children: list["ResourceType"] | None = None
    labels: list[str] | None = None
    abstract: bool | None = None
    workspace_id: uuid.UUID | None = None
    workspace: WorkspaceType | None = None
    state: str | None = None
    status: str | None = None
    revision_number: int | None = None
    created_by: uuid.UUID | None = None
    creator: UserType | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
