import uuid
import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.integrations.model import Integration
from graphql_api.modules.user.types import UserType


integration_mapper = StrawberrySQLAlchemyMapper()


@integration_mapper.type(Integration)
class IntegrationType:
    __exclude__ = ["created_by"]

    id: uuid.UUID = strawberry.UNSET
    creator: UserType | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "integration"

    @strawberry.field
    async def resource_count(self, info: Info) -> int:
        return await info.context["loaders"]["integration_resource_count"].load(str(self.id))

    @strawberry.field
    async def source_code_count(self, info: Info) -> int:
        return await info.context["loaders"]["integration_source_code_count"].load(str(self.id))

    @strawberry.field
    async def workspace_count(self, info: Info) -> int:
        return await info.context["loaders"]["integration_workspace_count"].load(str(self.id))

    @strawberry.field
    async def storage_count(self, info: Info) -> int:
        return await info.context["loaders"]["integration_storage_count"].load(str(self.id))

    @strawberry.field
    async def executor_count(self, info: Info) -> int:
        return await info.context["loaders"]["integration_executor_count"].load(str(self.id))


@strawberry.type
class IntegrationValidationType:
    is_valid: bool
    message: str | None = None


integration_mapper.finalize()
