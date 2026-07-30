from typing import cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.providers.kubernetes.kubernetes_integration import build_kubernetes_client
from application.resources.dependencies import get_resource_service
from core.errors import EntityNotFound
from core.users.functions import user_has_access_to_entity
from graphql_api.helpers import IsAuthenticated


async def _get_client(info: Info, k8s_service: str, resource_id: str):
    user = info.context["user"]
    session = info.context["session"]
    resource_service = get_resource_service(session=session)
    resource = await resource_service.get_by_id(resource_id)
    if not resource:
        raise EntityNotFound(f"Resource with id {resource_id} not found")

    if not await user_has_access_to_entity(user, resource_id, "write", "resource") and not (
        resource.project_id and await user_has_access_to_entity(user, resource.project_id, "write", "project")
    ):
        raise PermissionError("Write access to resource is required")

    return await build_kubernetes_client(k8s_service, resource, session)


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
