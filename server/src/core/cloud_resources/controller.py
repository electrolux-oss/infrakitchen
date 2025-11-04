from fastapi import Response
from ..errors import EntityNotFound
from ..adapters.cloud_resource_adapter import CloudResourceAdapter
from .model import CloudResourceModel


class CloudResourcesCRUD:
    def __init__(self, entity_model: type[CloudResourceModel]):
        self.entity_model: type[CloudResourceModel] = entity_model

    async def get_many(self, response: Response) -> list[CloudResourceModel]:
        resources = await get_cloud_resources()
        headers = {"Content-Range": f"cloud_resources 0-{len(resources)}/{len(resources)}"}
        response.headers.update(headers)
        return resources

    async def get_one(self, resource_name: str) -> CloudResourceModel:
        resource = await get_cloud_resource(resource_name=resource_name)
        return resource


async def get_cloud_resources() -> list[CloudResourceModel]:
    providers = await get_supported_providers()
    resources: list[CloudResourceModel] = []

    for provider in providers:
        prov: CloudResourceAdapter = CloudResourceAdapter.providers[provider]
        result = await prov.get_resources()
        resources += [
            CloudResourceModel(id=resource_name, provider=provider, name=resource_name) for resource_name in result
        ]

    return resources


async def get_supported_providers() -> list[str]:
    return list(CloudResourceAdapter.providers.keys())


async def get_cloud_resource(resource_name: str) -> CloudResourceModel:
    resources = await get_cloud_resources()
    for resource in resources:
        if resource.name == resource_name:
            return resource

    raise EntityNotFound(f"Resource {resource_name} not found")
