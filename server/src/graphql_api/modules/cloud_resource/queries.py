from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from core.cloud_resources.controller import get_cloud_resource, get_cloud_resources
from graphql_api.helpers import IsAuthenticated, check_api_permission, parse_range, parse_sort
from graphql_api.modules.cloud_resource.types import CloudResourceType, to_graphql_type


def _apply_filter(resources: list[CloudResourceType], filter_value: dict[str, Any] | None) -> list[CloudResourceType]:
    if not filter_value:
        return resources

    filtered = resources
    for key, expected in filter_value.items():
        if expected in (None, ""):
            continue

        normalized_key = "entity_name" if key == "entityName" else key
        filtered = [resource for resource in filtered if getattr(resource, normalized_key, None) == expected]
    return filtered


def _apply_sort(resources: list[CloudResourceType], sort_value: tuple[str, str] | None) -> list[CloudResourceType]:
    if not sort_value:
        return resources

    field_name, direction = sort_value
    normalized_field = "entity_name" if field_name == "entityName" else field_name
    reverse = direction.upper() == "DESC"
    return sorted(
        resources, key=lambda resource: cast(Any, getattr(resource, normalized_field, None)) or "", reverse=reverse
    )


def _apply_range(resources: list[CloudResourceType], range_value: tuple[int, int] | None) -> list[CloudResourceType]:
    if not range_value:
        return resources

    start, end = range_value
    return resources[start : end + 1]


@strawberry.type
class CloudResourceQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def cloud_resource(self, info: Info, id: str) -> CloudResourceType | None:
        await check_api_permission(info, "cloud_resource", ["read"])
        resource = await get_cloud_resource(resource_name=id)
        return to_graphql_type(resource)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def cloud_resources(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[CloudResourceType]:
        await check_api_permission(info, "cloud_resource", ["read"])
        resources = [to_graphql_type(resource) for resource in await get_cloud_resources()]
        resources = _apply_filter(resources, cast(dict[str, Any], cast(object, filter)) if filter else None)
        resources = _apply_sort(resources, parse_sort(sort))
        resources = _apply_range(resources, parse_range(range))
        return resources

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def cloud_resources_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        await check_api_permission(info, "cloud_resource", ["read"])
        resources = [to_graphql_type(resource) for resource in await get_cloud_resources()]
        resources = _apply_filter(resources, cast(dict[str, Any], cast(object, filter)) if filter else None)
        return len(resources)
