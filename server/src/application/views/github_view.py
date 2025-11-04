from fastapi import APIRouter, Depends, HTTPException, Request

from application.integrations.service import IntegrationService
from application.integrations.dependencies import get_integration_service
from application.providers.github.github_api import GithubApi
from application.providers.github.schema import (
    GitHubRepository,
    GithubOrganization,
    GithubPullRequest,
)

from core.adapters.provider_adapters import IntegrationProvider

router = APIRouter()


async def get_github_client(
    request: Request,
    integration_service: IntegrationService = Depends(get_integration_service),
) -> GithubApi:
    integration_id = request.query_params.get("integration_id")
    if not integration_id:
        raise HTTPException(status_code=400, detail="integration_id query parameter is required")

    integration = await integration_service.get_by_id(integration_id)
    if not integration or integration.integration_provider != "github":
        raise HTTPException(status_code=400, detail="Integration for Github not found")

    provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get("github")

    if not provider_adapter:
        raise HTTPException(status_code=404, detail="Provider adapter for Github not found")

    provider_adapter_instance: IntegrationProvider = provider_adapter(**{"configuration": integration.configuration})

    await provider_adapter_instance.authenticate()
    return await provider_adapter_instance.get_api_client()


@router.get(
    "/provider/github/organizations",
    response_description="Get user organizations",
    response_model=list[GithubOrganization],
)
async def get_user_organizations(github_client: GithubApi = Depends(get_github_client)):
    return await github_client.get_user_orgs()


@router.get(
    "/provider/github/{org}/repos",
    response_description="Get repositories for organization",
    response_model=list[GitHubRepository],
)
async def get_org_repos(org: str, github_client: GithubApi = Depends(get_github_client)):
    return await github_client.get_all_repos_for_org(org=org)


@router.get(
    "/provider/github/repos/{org}/{repo}",
    response_description="Get repository details",
    response_model=GitHubRepository,
)
async def get_repo(org: str, repo: str, github_client: GithubApi = Depends(get_github_client)):
    return await github_client.get_repo(org=org, repo=repo)


@router.get(
    "/provider/github/repos/{org}/{repo}/pulls",
    response_description="Get pull requests for repository",
    response_model=list[GithubPullRequest],
)
async def get_pull_requests(org: str, repo: str, github_client: GithubApi = Depends(get_github_client)):
    return await github_client.get_pull_requests(org=org, repo=repo)
