import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.workspaces.model import Workspace

from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.user.types import UserType


workspace_mapper = StrawberrySQLAlchemyMapper()


@workspace_mapper.type(Workspace)
class WorkspaceType:
    __exclude__ = ["created_by", "integration_id"]

    id: str = strawberry.UNSET
    creator: UserType | None = None
    integration: IntegrationType | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "workspace"

    @strawberry.field
    async def resources_count(self, info: Info) -> int:
        return await info.context["loaders"]["workspace_resource_count"].load(str(self.id))


workspace_mapper.finalize()
