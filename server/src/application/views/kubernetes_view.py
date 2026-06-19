from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from application.providers.kubernetes.kubernetes_integration import build_kubernetes_client
from core.dependencies import get_db_session
from core.tools.kubernetes_client import KubernetesClient
from core.users.functions import user_has_access_to_entity
from core.users.model import UserDTO

router = APIRouter()


async def check_resource_write_access(request: Request, resource_id: str) -> None:
    requester: UserDTO | None = getattr(request.state, "user", None)
    if not requester:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not await user_has_access_to_entity(requester, resource_id, "write", "resource"):
        raise HTTPException(status_code=403, detail="Write access to resource is required for provider API")


async def get_kubernetes_client(
    k8s_service: str,
    resource_id: str,
    session: AsyncSession = Depends(get_db_session),
    _access: None = Depends(check_resource_write_access),
) -> KubernetesClient:
    try:
        return await build_kubernetes_client(k8s_service, resource_id, session)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/provider/kubernetes/{k8s_service}/{resource_id}/namespaces",
    response_description="Get namespaces in Kubernetes",
    response_model=list[Any],
    deprecated=True,
)
async def get_namespaces(kubernetes_client: KubernetesClient = Depends(get_kubernetes_client)):
    return await kubernetes_client.list_namespaces()


@router.get(
    "/provider/kubernetes/{k8s_service}/{resource_id}/namespaces/{namespace}/deployments/{deployment_name}/pods",
    response_description="Get pods in a specific deployment",
    response_model=list[Any],
    deprecated=True,
)
async def get_deployment_pods(
    request: Request,
    namespace: str,
    deployment_name: str,
    kubernetes_client: KubernetesClient = Depends(get_kubernetes_client),
):
    query_params = request.query_params
    pods = await kubernetes_client.list_deployment_pods(
        deployment_name=deployment_name, namespace=namespace, raw=query_params.get("raw", "false").lower() == "true"
    )
    if not pods:
        raise HTTPException(status_code=404, detail="No pods found for the specified deployment")
    return pods


@router.get(
    "/provider/kubernetes/{k8s_service}/{resource_id}/namespaces/{namespace}/pods",
    response_description="Get pods in a specific namespace",
    response_model=list[Any],
    deprecated=True,
)
async def get_namespaced_pods(namespace: str, kubernetes_client: KubernetesClient = Depends(get_kubernetes_client)):
    return await kubernetes_client.list_namespaced_pods(namespace=namespace)


@router.get(
    "/provider/kubernetes/{k8s_service}/{resource_id}/services/{namespace}",
    response_description="Get services in a specific namespace",
    response_model=list[Any],
    deprecated=True,
)
async def get_namespaced_services(namespace: str, kubernetes_client: KubernetesClient = Depends(get_kubernetes_client)):
    return await kubernetes_client.list_namespaced_services(namespace=namespace)


@router.get(
    "/provider/kubernetes/{k8s_service}/{resource_id}/deployments/{namespace}",
    response_description="Get deployments in a specific namespace",
    response_model=list[Any],
    deprecated=True,
)
async def get_namespaced_deployments(
    namespace: str, kubernetes_client: KubernetesClient = Depends(get_kubernetes_client)
):
    return await kubernetes_client.list_namespaced_deployment(namespace=namespace)


@router.delete(
    "/provider/kubernetes/{k8s_service}/{resource_id}/namespaces/{namespace}/pods/{pod_name}",
    response_description="Delete a specific pod in a namespace",
    response_model=dict[str, str],
    deprecated=True,
)
async def delete_pod(
    namespace: str,
    pod_name: str,
    kubernetes_client: KubernetesClient = Depends(get_kubernetes_client),
):
    try:
        await kubernetes_client.delete_namespaced_pod(namespace=namespace, pod_name=pod_name)
        return {"message": f"Pod '{pod_name}' in namespace '{namespace}' deleted successfully."}
    except Exception as e:
        raise ValueError(f"Failed to delete pod '{pod_name}' in namespace '{namespace}': {str(e)}") from e


@router.put(
    "/provider/kubernetes/{k8s_service}/{resource_id}/namespaces/{namespace}/deployments/{deployment_name}",
    response_description="Restart all pods in a deployment",
    response_model=dict[str, str],
    deprecated=True,
)
async def restart_deployment(
    namespace: str,
    deployment_name: str,
    kubernetes_client: KubernetesClient = Depends(get_kubernetes_client),
):
    try:
        await kubernetes_client.restart_namespaced_deployment(namespace=namespace, deployment=deployment_name)
        return {"message": f"Deployment '{deployment_name}' in namespace '{namespace}' restarted successfully."}
    except Exception as e:
        raise ValueError(
            f"Failed to restart deployment '{deployment_name}' in namespace '{namespace}': {str(e)}"
        ) from e
