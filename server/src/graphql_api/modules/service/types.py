import uuid

import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.services.model import Service
from graphql_api.modules.project.types import ProjectType
from graphql_api.modules.user.types import UserType


service_mapper = StrawberrySQLAlchemyMapper()


@service_mapper.type(Service)
class ServiceType:
    # Only the relation is excluded, so it can be re-declared with ProjectType.
    # The project_id scalar stays auto-mapped and queryable.
    __exclude__ = ["created_by", "project"]

    id: uuid.UUID = strawberry.UNSET
    creator: UserType | None = None
    owners: list[UserType] = strawberry.field(default_factory=list)
    project: ProjectType | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "service"


service_mapper.finalize()
