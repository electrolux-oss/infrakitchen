import uuid

import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.resources.model import Resource
from application.validation_rules.schema import ValidationRuleResponse

from graphql_api.dataloaders.entity_loaders import get_favorite_status_loader
from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.secret.types import SecretType
from graphql_api.modules.source_code_version.types import SourceCodeVersionType
from graphql_api.modules.storage.types import StorageType
from graphql_api.modules.template.types import TemplateType
from graphql_api.modules.user.types import UserType
from graphql_api.modules.workspace.types import WorkspaceType
from graphql_api.modules.project.types import ProjectType


resource_mapper = StrawberrySQLAlchemyMapper()


@resource_mapper.type(Resource)
class ResourceType:
    __exclude__ = [
        "template_id",
        "template",
        "storage",
        "storage_id",
        "integration_ids",
        "secret_ids",
        "parents",
        "children",
        "created_by",
        "workspace_id",
        "project_id",
        "project",
        "source_code_version_id",
    ]

    id: uuid.UUID = strawberry.UNSET
    template: TemplateType | None = None
    storage: StorageType | None = None
    workspace: WorkspaceType | None = None
    project: ProjectType | None = None
    source_code_version: SourceCodeVersionType | None = None
    integration_ids: list[IntegrationType] | None = None
    secret_ids: list[SecretType] | None = None
    parents: list["ResourceType"] | None = None
    children: list["ResourceType"] | None = None
    creator: UserType | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "resource"

    @strawberry.field
    async def is_favorite(self, info: Info) -> bool:
        user = info.context.get("user")
        if user is None:
            return False

        loader = get_favorite_status_loader(info, str(user.id), "resource")
        return await loader.load(str(self.id))


resource_mapper.finalize()


@strawberry.type
class ValidationRuleResponseType:
    id: uuid.UUID | None
    target_type: str
    description: str | None
    min_value: str | None
    max_value: str | None
    regex_pattern: str | None
    max_length: int | None

    @classmethod
    def from_pydantic(cls, rule: ValidationRuleResponse) -> "ValidationRuleResponseType":
        return cls(
            id=rule.id,
            target_type=rule.target_type,
            description=rule.description,
            min_value=str(rule.min_value) if rule.min_value is not None else None,
            max_value=str(rule.max_value) if rule.max_value is not None else None,
            regex_pattern=rule.regex_pattern,
            max_length=rule.max_length,
        )


@strawberry.type
class ResourceVariableSchemaType:
    name: str
    type: str
    description: str | None
    options: list[str]
    required: bool
    frozen: bool
    unique: bool
    sensitive: bool
    restricted: bool
    value: strawberry.scalars.JSON | None
    index: int
    validation_rules: list[ValidationRuleResponseType]


@strawberry.type
class ResourceDownloadType:
    filename: str
    content_type: str
    content_base64: str
