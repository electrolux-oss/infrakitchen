import uuid
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.secrets.model import Secret

import strawberry
from strawberry.types import Info

from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.user.types import UserType


secret_mapper = StrawberrySQLAlchemyMapper()


@secret_mapper.type(Secret)
class SecretType:
    __exclude__ = ["created_by", "integration_id"]

    id: uuid.UUID = strawberry.UNSET
    creator: UserType | None = None
    integration: IntegrationType | None = None

    @strawberry.field
    async def resources_count(self, info: Info) -> int:
        return await info.context["loaders"]["secret_resource_count"].load(str(self.id))

    @strawberry.field
    async def executors_count(self, info: Info) -> int:
        return await info.context["loaders"]["secret_executor_count"].load(str(self.id))


secret_mapper.finalize()
