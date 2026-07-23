import uuid

import strawberry
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.projects.model import Project
from graphql_api.modules.user.types import UserType


project_mapper = StrawberrySQLAlchemyMapper()


@project_mapper.type(Project)
class ProjectType:
    __exclude__ = ["created_by"]

    id: uuid.UUID = strawberry.UNSET
    creator: UserType | None = None
    owners: list[UserType] = strawberry.field(default_factory=list)

    @strawberry.field
    def entity_name(self) -> str:
        return "project"

    @strawberry.field
    async def resources_count(self, info: Info) -> int:
        return await info.context["loaders"]["project_resource_count"].load(str(self.id))


project_mapper.finalize()
