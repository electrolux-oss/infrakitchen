import uuid

import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.executors.model import Executor

from graphql_api.dataloaders.entity_loaders import get_favorite_status_loader
from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.secret.types import SecretType
from graphql_api.modules.source_code.types import SourceCodeType
from graphql_api.modules.storage.types import StorageType
from graphql_api.modules.user.types import UserType


executor_mapper = StrawberrySQLAlchemyMapper()


@executor_mapper.type(Executor)
class ExecutorType:
    __exclude__ = ["integration_ids", "secret_ids", "created_by"]

    id: uuid.UUID = strawberry.UNSET
    integration_ids: list[IntegrationType] | None = None
    secret_ids: list[SecretType] | None = None
    source_code: SourceCodeType | None = None
    storage: StorageType | None = None
    creator: UserType | None = None

    @strawberry.field
    async def is_favorite(self, info: Info) -> bool:
        user = info.context.get("user")
        if user is None:
            return False

        loader = get_favorite_status_loader(info, str(user.id), "executor")
        return await loader.load(str(self.id))


executor_mapper.finalize()
