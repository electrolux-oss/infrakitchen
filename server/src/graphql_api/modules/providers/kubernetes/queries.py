from typing import cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.providers.kubernetes.kubernetes_integration import build_kubernetes_client
from core.users.functions import user_has_access_to_entity
from core.utils.json_encoder import json_serialize
from graphql_api.helpers import IsAuthenticated


async def _get_client(info: Info, k8s_service: str, resource_id: str):
    user = info.context["user"]
    if not await user_has_access_to_entity(user, resource_id, "write", "resource"):
        raise PermissionError("Write access to resource is required")
    session = info.context["session"]
    return await build_kubernetes_client(k8s_service, resource_id, session)


@strawberry.type
class KubernetesQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def kubernetes_namespaces(
        self,
        info: Info,
        k8s_service: str,
        resource_id: str,
    ) -> list[JSON]:
        await user_has_access_to_entity(info.context.get("user"), resource_id, "write", "resource")
        client = await _get_client(info, k8s_service, resource_id)
        return cast(list[JSON], await client.list_namespaces())

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def kubernetes_deployments(
        self,
        info: Info,
        k8s_service: str,
        resource_id: str,
        namespace: str,
    ) -> list[JSON]:
        await user_has_access_to_entity(info.context.get("user"), resource_id, "write", "resource")
        client = await _get_client(info, k8s_service, resource_id)
        return cast(list[JSON], await client.list_namespaced_deployment(namespace=namespace))

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def kubernetes_pods(
        self,
        info: Info,
        k8s_service: str,
        resource_id: str,
        namespace: str,
    ) -> list[JSON]:
        await user_has_access_to_entity(info.context.get("user"), resource_id, "write", "resource")
        client = await _get_client(info, k8s_service, resource_id)
        return cast(list[JSON], await client.list_namespaced_pods(namespace=namespace))

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def kubernetes_services(
        self,
        info: Info,
        k8s_service: str,
        resource_id: str,
        namespace: str,
    ) -> list[JSON]:
        await user_has_access_to_entity(info.context.get("user"), resource_id, "write", "resource")
        client = await _get_client(info, k8s_service, resource_id)
        return cast(list[JSON], await client.list_namespaced_services(namespace=namespace))

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def kubernetes_deployment_pods(
        self,
        info: Info,
        k8s_service: str,
        resource_id: str,
        namespace: str,
        deployment_name: str,
    ) -> list[JSON]:
        await user_has_access_to_entity(info.context.get("user"), resource_id, "write", "resource")
        client = await _get_client(info, k8s_service, resource_id)
        pods = await client.list_deployment_pods(deployment_name=deployment_name, namespace=namespace, raw=True)

        return cast(list[JSON], json_serialize(pods))
