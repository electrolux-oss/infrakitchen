import uuid
import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.storages.model import Storage

from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.user.types import UserType


storage_mapper = StrawberrySQLAlchemyMapper()


@storage_mapper.type(Storage)
class StorageType:
    __exclude__ = ["integration_id", "created_by", "integration"]

    id: uuid.UUID = strawberry.UNSET
    creator: UserType | None = None
    integration: IntegrationType | None = None

    @strawberry.field
    async def resources_count(self, info: Info) -> int:
        return await info.context["loaders"]["storage_resource_count"].load(str(self.id))

    @strawberry.field
    async def executors_count(self, info: Info) -> int:
        return await info.context["loaders"]["storage_executor_count"].load(str(self.id))


storage_mapper.finalize()
