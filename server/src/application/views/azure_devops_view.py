from fastapi import APIRouter, Depends, HTTPException, Request

from application.integrations.service import IntegrationService
from application.integrations.dependencies import get_integration_service
from application.providers.azurerm.azure_devops_api import AzureDevopsApi
from application.providers.azurerm.schema import AzureDevOpsProject, AzureDevOpsRepository, AzureDevOpsPullRequest

from core.adapters.provider_adapters import IntegrationProvider

router = APIRouter()


async def get_azure_devops_client(
    request: Request,
    integration_service: IntegrationService = Depends(get_integration_service),
) -> AzureDevopsApi:
    integration_id = request.query_params.get("integration_id")
    if not integration_id:
        raise HTTPException(status_code=400, detail="integration_id query parameter is required")

    integration = await integration_service.get_by_id(integration_id)
    if not integration or integration.integration_provider != "azure_devops":
        raise HTTPException(status_code=400, detail="Integration for Azure DevOps not found")

    provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get("azure_devops")

    if not provider_adapter:
        raise HTTPException(status_code=404, detail="Provider adapter for AzureDevops not found")

    provider_adapter_instance: IntegrationProvider = provider_adapter(**{"configuration": integration.configuration})

    await provider_adapter_instance.authenticate()
    return await provider_adapter_instance.get_api_client()


@router.get(
    "/provider/azure_devops/projects",
    response_description="Get Azure DevOps projects",
    response_model=list[AzureDevOpsProject],
)
async def get_org_projects(azure_devops_client: AzureDevopsApi = Depends(get_azure_devops_client)):
    return await azure_devops_client.get_projects()


@router.get(
    "/provider/azure_devops/{project}/repos",
    response_description="Get repositories for project",
    response_model=list[AzureDevOpsRepository],
)
async def get_org_repos(project: str, azure_devops_client: AzureDevopsApi = Depends(get_azure_devops_client)):
    result = await azure_devops_client.get_all_repos_for_project(project=project)
    return [repo for repo in result if repo.is_disabled is False]


@router.get(
    "/provider/azure_devops/repos/{project}/{repo}",
    response_description="Get repository details",
    response_model=AzureDevOpsRepository,
    response_model_by_alias=False,
)
async def get_repo(project: str, repo: str, azure_devops_client: AzureDevopsApi = Depends(get_azure_devops_client)):
    return await azure_devops_client.get_repo(project=project, repo_id=repo)


@router.get(
    "/provider/azure_devops/repos/{project}/{repo}/pulls",
    response_description="Get pull requests for repository",
    response_model=list[AzureDevOpsPullRequest],
)
async def get_pull_requests(
    project: str,
    repo: str,
    azure_devops_client: AzureDevopsApi = Depends(get_azure_devops_client),
):
    return await azure_devops_client.get_pull_requests(project=project, repo_id=repo)
