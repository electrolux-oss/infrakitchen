import uuid

import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.iac.model import IacEnvironmentConfig, IacRun
from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.storage.types import StorageType
from graphql_api.modules.task_queue.types import EntityQueueStatusType, resolve_task_queue_status
from graphql_api.modules.tool.types import ToolType
from graphql_api.modules.user.types import UserType

iac_mapper = StrawberrySQLAlchemyMapper()


@iac_mapper.type(IacEnvironmentConfig)
class IacEnvironmentConfigType:
    __exclude__ = ["integrations", "storage", "tool", "created_by"]

    id: uuid.UUID = strawberry.UNSET
    integrations: list[IntegrationType] = strawberry.field(default_factory=list)
    storage: StorageType | None = None
    tool: ToolType | None = None


@iac_mapper.type(IacRun)
class IacRunType:
    __exclude__ = ["created_by", "creator"]

    id: uuid.UUID = strawberry.UNSET
    creator: UserType | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "iac_run"

    @strawberry.field
    async def task_queue_status(self, info: Info) -> EntityQueueStatusType | None:
        return await resolve_task_queue_status(info, "iac_run", self.id)


iac_mapper.finalize()
