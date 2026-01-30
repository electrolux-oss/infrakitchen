from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request

from application.integrations.service import IntegrationService
from application.integrations.dependencies import get_integration_service

from application.resources.dependencies import get_resource_service
from application.resources.service import ResourceService
from core.adapters.cloud_resource_adapter import CloudResourceAdapter
from core.adapters.provider_adapters import IntegrationProvider
from core.tools.kubernetes_client import KubernetesClient

router = APIRouter()


async def get_kubernetes_client(
    k8s_service: str,
    resource_id: str,
    integration_service: IntegrationService = Depends(get_integration_service),
    resource_service: ResourceService = Depends(get_resource_service),
) -> KubernetesClient:
    resource = await resource_service.get_by_id(resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    integration_provider: str = ""

    if k8s_service == "aws_eks":
        integration_provider = "aws"
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported Kubernetes service: {k8s_service}")

    provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get(integration_provider)

    if not provider_adapter:
        raise HTTPException(status_code=404, detail=f"Provider adapter for '{integration_provider}' not found")

    cloud_provider: type[CloudResourceAdapter] | None = CloudResourceAdapter.providers.get(integration_provider)
    if not cloud_provider:
        raise HTTPException(status_code=404, detail=f"Cloud provider adapter for '{integration_provider}' not found")

    fintered_integration = next(
        (
            integration
            for integration in resource.integration_ids
            if integration.integration_provider == integration_provider
        ),
        None,
    )

    if not fintered_integration:
        raise HTTPException(status_code=404, detail=f"Integration for {integration_provider} not found in resource")

    integration = await integration_service.get_by_id(str(fintered_integration.id))

    if not integration:
        raise HTTPException(
            status_code=404, detail=f"Integration for integration_provider '{integration_provider}'  not found"
        )

    provider_adapter_instance: IntegrationProvider = provider_adapter(**{"configuration": integration.configuration})

    await provider_adapter_instance.authenticate()

    variables: dict[str, Any] = dict()

    for variable in resource.variables:
        variables.update({variable.name: variable.value})

    cloud_resource: CloudResourceAdapter = CloudResourceAdapter.providers[integration.integration_provider](
        provider_adapter_instance.environment_variables
    )

    k8s_metadata = await cloud_resource.metadata(resource_name=k8s_service, **variables)

    return await provider_adapter_instance.get_kubernetes_client(k8s_metadata)


@router.get(
    "/provider/kubernetes/{k8s_service}/{resource_id}/namespaces",
    response_description="Get namespaces in Kubernetes",
    response_model=list[Any],
)
async def get_namespaces(kubernetes_client: KubernetesClient = Depends(get_kubernetes_client)):
    return await kubernetes_client.list_namespaces()


@router.get(
    "/provider/kubernetes/{k8s_service}/{resource_id}/namespaces/{namespace}/deployments/{deployment_name}/pods",
    response_description="Get pods in a specific deployment",
    response_model=list[Any],
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
)
async def get_namespaced_pods(namespace: str, kubernetes_client: KubernetesClient = Depends(get_kubernetes_client)):
    return await kubernetes_client.list_namespaced_pods(namespace=namespace)


@router.get(
    "/provider/kubernetes/{k8s_service}/{resource_id}/services/{namespace}",
    response_description="Get services in a specific namespace",
    response_model=list[Any],
)
async def get_namespaced_services(namespace: str, kubernetes_client: KubernetesClient = Depends(get_kubernetes_client)):
    return await kubernetes_client.list_namespaced_services(namespace=namespace)


@router.get(
    "/provider/kubernetes/{k8s_service}/{resource_id}/deployments/{namespace}",
    response_description="Get deployments in a specific namespace",
    response_model=list[Any],
)
async def get_namespaced_deployments(
    namespace: str, kubernetes_client: KubernetesClient = Depends(get_kubernetes_client)
):
    return await kubernetes_client.list_namespaced_deployment(namespace=namespace)


@router.delete(
    "/provider/kubernetes/{k8s_service}/{resource_id}/namespaces/{namespace}/pods/{pod_name}",
    response_description="Delete a specific pod in a namespace",
    response_model=dict[str, str],
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
