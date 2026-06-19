from typing import cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.providers.kubernetes.kubernetes_integration import build_kubernetes_client
from core.users.functions import user_has_access_to_entity
from graphql_api.helpers import IsAuthenticated


async def _get_client(info: Info, k8s_service: str, resource_id: str):
    user = info.context["user"]
    if not await user_has_access_to_entity(user, resource_id, "write", "resource"):
        raise PermissionError("Write access to resource is required")
    session = info.context["session"]
    return await build_kubernetes_client(k8s_service, resource_id, session)


@strawberry.type
class KubernetesMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_kubernetes_pod(
        self,
        info: Info,
        k8s_service: str,
        resource_id: str,
        namespace: str,
        pod_name: str,
    ) -> JSON:
        client = await _get_client(info, k8s_service, resource_id)
        await client.delete_namespaced_pod(pod_name=pod_name, namespace=namespace)
        return cast(
            JSON,
            cast(object, {"message": f"Pod '{pod_name}' in namespace '{namespace}' deleted successfully."}),
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def restart_kubernetes_deployment(
        self,
        info: Info,
        k8s_service: str,
        resource_id: str,
        namespace: str,
        deployment_name: str,
    ) -> JSON:
        client = await _get_client(info, k8s_service, resource_id)
        await client.restart_namespaced_deployment(deployment=deployment_name, namespace=namespace)
        return cast(
            JSON,
            cast(
                object,
                {"message": f"Deployment '{deployment_name}' in namespace '{namespace}' restarted successfully."},
            ),
        )
