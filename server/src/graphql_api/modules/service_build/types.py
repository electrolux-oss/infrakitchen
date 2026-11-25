import uuid

import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.service_builds.model import ServiceBuild
from graphql_api.modules.user.types import UserType


service_build_mapper = StrawberrySQLAlchemyMapper()


@strawberry.type
class ServiceBuildImageType:
    registry_integration_id: uuid.UUID
    registry_name: str
    registry_provider: str
    image_repository: str
    image: str | None


def resolve_images(root: strawberry.Parent[ServiceBuild]) -> list[ServiceBuildImageType]:
    return [
        ServiceBuildImageType(
            registry_integration_id=uuid.UUID(image["registry_integration_id"]),
            registry_name=image["registry_name"],
            registry_provider=image["registry_provider"],
            image_repository=image["image_repository"],
            image=image["image"],
        )
        for image in root.images
    ]


@service_build_mapper.type(ServiceBuild)
class ServiceBuildType:
    __exclude__ = ["created_by", "images"]

    id: uuid.UUID = strawberry.UNSET
    creator: UserType | None = None
    images: list[ServiceBuildImageType] = strawberry.field(resolver=resolve_images)

    @strawberry.field
    def entity_name(self) -> str:
        return "service_build"


service_build_mapper.finalize()
