import uuid

from fastapi import APIRouter, Depends, HTTPException, Request

from application.providers.azurerm.azure_devops_api import AzureDevopsApi
from application.providers.azurerm.azure_devops_integration import (
    get_azure_devops_client as get_azure_devops_client_for_integration,
)
from application.providers.azurerm.schema import AzureDevOpsProject, AzureDevOpsRepository, AzureDevOpsPullRequest

router = APIRouter()


async def get_azure_devops_client(
    request: Request,
) -> AzureDevopsApi:
    integration_id = request.query_params.get("integration_id")
    if not integration_id:
        raise HTTPException(status_code=400, detail="integration_id query parameter is required")
    try:
        return await get_azure_devops_client_for_integration(uuid.UUID(integration_id), request.state.session)
    except ValueError as exc:
        detail = str(exc)
        if "badly formed" in detail:
            raise HTTPException(status_code=400, detail="integration_id query parameter is invalid") from exc
        status_code = 404 if "Provider adapter" in detail else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.get(
    "/provider/azure_devops/projects",
    response_description="Get Azure DevOps projects",
    response_model=list[AzureDevOpsProject],
    deprecated=True,
)
async def get_org_projects(azure_devops_client: AzureDevopsApi = Depends(get_azure_devops_client)):
    return await azure_devops_client.get_projects()


@router.get(
    "/provider/azure_devops/{project}/repos",
    response_description="Get repositories for project",
    response_model=list[AzureDevOpsRepository],
    deprecated=True,
)
async def get_org_repos(project: str, azure_devops_client: AzureDevopsApi = Depends(get_azure_devops_client)):
    result = await azure_devops_client.get_all_repos_for_project(project=project)
    return [repo for repo in result if repo.is_disabled is False]


@router.get(
    "/provider/azure_devops/repos/{project}/{repo}",
    response_description="Get repository details",
    response_model=AzureDevOpsRepository,
    response_model_by_alias=False,
    deprecated=True,
)
async def get_repo(project: str, repo: str, azure_devops_client: AzureDevopsApi = Depends(get_azure_devops_client)):
    return await azure_devops_client.get_repo(project=project, repo_id=repo)


@router.get(
    "/provider/azure_devops/repos/{project}/{repo}/pulls",
    response_description="Get pull requests for repository",
    response_model=list[AzureDevOpsPullRequest],
    deprecated=True,
)
async def get_pull_requests(
    project: str,
    repo: str,
    azure_devops_client: AzureDevopsApi = Depends(get_azure_devops_client),
):
    return await azure_devops_client.get_pull_requests(project=project, repo_id=repo)
