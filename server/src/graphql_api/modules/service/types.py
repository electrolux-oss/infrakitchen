import uuid

import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.services.model import Service
from graphql_api.modules.project.types import ProjectType
from graphql_api.modules.resource.types import ResourceType
from graphql_api.modules.source_code.types import SourceCodeType
from graphql_api.modules.user.types import UserType


service_mapper = StrawberrySQLAlchemyMapper()


@service_mapper.type(Service)
class ServiceType:
    # Relations are re-declared below with their own GraphQL types
    __exclude__ = ["created_by", "project", "source_code", "image_resource"]

    id: uuid.UUID = strawberry.UNSET
    creator: UserType | None = None
    owners: list[UserType] = strawberry.field(default_factory=list)
    project: ProjectType | None = None
    source_code: SourceCodeType | None = None
    image_resource: ResourceType | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "service"


service_mapper.finalize()
