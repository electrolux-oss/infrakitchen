import strawberry

from core.cloud_resources.model import CloudResourceModel


@strawberry.type
class CloudResourceType:
    id: str
    provider: str
    name: str
    status: str = "enabled"

    @strawberry.field
    def entity_name(self) -> str:
        return "cloud_resource"


def to_graphql_type(resource: CloudResourceModel) -> CloudResourceType:
    return CloudResourceType(id=resource.id, provider=resource.provider, name=resource.name)
