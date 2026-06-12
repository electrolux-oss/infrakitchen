import uuid

import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.resources.model import Resource

from graphql_api.dataloaders.entity_loaders import get_favorite_status_loader
from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.secret.types import SecretType
from graphql_api.modules.source_code_version.types import SourceCodeVersionType
from graphql_api.modules.storage.types import StorageType
from graphql_api.modules.template.types import TemplateType
from graphql_api.modules.user.types import UserType
from graphql_api.modules.workspace.types import WorkspaceType


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
        "source_code_version_id",
    ]

    id: uuid.UUID = strawberry.UNSET
    template: TemplateType | None = None
    storage: StorageType | None = None
    workspace: WorkspaceType | None = None
    source_code_version: SourceCodeVersionType | None = None
    integration_ids: list[IntegrationType] | None = None
    secret_ids: list[SecretType] | None = None
    parents: list["ResourceType"] | None = None
    children: list["ResourceType"] | None = None
    creator: UserType | None = None

    @strawberry.field
    async def is_favorite(self, info: Info) -> bool:
        user = info.context.get("user")
        if user is None:
            return False

        loader = get_favorite_status_loader(info, str(user.id), "resource")
        return await loader.load(str(self.id))


resource_mapper.finalize()
