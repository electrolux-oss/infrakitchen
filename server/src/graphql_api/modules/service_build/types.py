import uuid

import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.service_builds.model import ServiceBuild, ServiceBuildImage
from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.user.types import UserType


service_build_mapper = StrawberrySQLAlchemyMapper()


@service_build_mapper.type(ServiceBuildImage)
class ServiceBuildImageType:
    __exclude__ = ["build_id", "position", "registry_integration"]

    id: uuid.UUID = strawberry.UNSET
    registry_integration: IntegrationType | None = None


@service_build_mapper.type(ServiceBuild)
class ServiceBuildType:
    __exclude__ = ["created_by", "images"]

    id: uuid.UUID = strawberry.UNSET
    creator: UserType | None = None
    images: list[ServiceBuildImageType] = strawberry.field(default_factory=list)

    @strawberry.field
    def entity_name(self) -> str:
        return "service_build"


service_build_mapper.finalize()
