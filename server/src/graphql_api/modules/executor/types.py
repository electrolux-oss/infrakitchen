import uuid
from datetime import datetime

import strawberry

from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.secret.types import SecretType
from graphql_api.modules.source_code.types import SourceCodeType
from graphql_api.modules.storage.types import StorageType
from graphql_api.modules.user.types import UserType


@strawberry.type
class ExecutorType:
    id: uuid.UUID
    name: str
    description: str = ""
    runtime: str = ""
    command_args: str = ""
    source_code_id: uuid.UUID | None = None
    source_code: SourceCodeType | None = None
    source_code_version: str | None = None
    source_code_branch: str | None = None
    source_code_folder: str = ""
    integration_ids: list[IntegrationType] | None = None
    secret_ids: list[SecretType] | None = None
    storage_id: uuid.UUID | None = None
    storage: StorageType | None = None
    storage_path: str | None = None
    labels: list[str] | None = None
    state: str = ""
    status: str = ""
    revision_number: int = 1
    created_by: uuid.UUID | None = None
    creator: UserType | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
