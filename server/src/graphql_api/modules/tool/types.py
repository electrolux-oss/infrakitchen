import uuid

import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from core.tools.model import Tool

from graphql_api.modules.user.types import UserType


tool_mapper = StrawberrySQLAlchemyMapper()


@tool_mapper.type(Tool)
class ToolType:
    __exclude__ = ["content", "created_by"]

    id: uuid.UUID = strawberry.UNSET
    creator: UserType | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "tool"

    @strawberry.field
    async def resources_count(self, info: Info) -> int:
        return await info.context["loaders"]["tool_resource_count"].load(str(self.id))

    @strawberry.field
    async def executors_count(self, info: Info) -> int:
        return await info.context["loaders"]["tool_executor_count"].load(str(self.id))


tool_mapper.finalize()
