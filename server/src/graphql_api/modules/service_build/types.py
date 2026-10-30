import uuid

import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.service_builds.model import ServiceBuild
from graphql_api.modules.user.types import UserType


service_build_mapper = StrawberrySQLAlchemyMapper()


@service_build_mapper.type(ServiceBuild)
class ServiceBuildType:
    __exclude__ = ["created_by"]

    id: uuid.UUID = strawberry.UNSET
    creator: UserType | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "service_build"


service_build_mapper.finalize()
