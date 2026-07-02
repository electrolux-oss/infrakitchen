import uuid

from fastapi import APIRouter, Depends, HTTPException, Request

from application.providers.github.github_api import GithubApi
from application.providers.github.github_integration import get_github_client as get_github_client_for_integration
from application.providers.github.schema import (
    GitHubRepository,
    GithubOrganization,
    GithubPullRequest,
)

router = APIRouter()


async def get_github_client(
    request: Request,
) -> GithubApi:
    integration_id = request.query_params.get("integration_id")
    if not integration_id:
        raise HTTPException(status_code=400, detail="integration_id query parameter is required")
    try:
        return await get_github_client_for_integration(uuid.UUID(integration_id), request.state.session)
    except ValueError as exc:
        detail = str(exc)
        if "badly formed" in detail:
            raise HTTPException(status_code=400, detail="integration_id query parameter is invalid") from exc
        status_code = 404 if "Provider adapter" in detail else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.get(
    "/provider/github/organizations",
    response_description="Get user organizations",
    response_model=list[GithubOrganization],
    deprecated=True,
)
async def get_user_organizations(github_client: GithubApi = Depends(get_github_client)):
    return await github_client.get_user_orgs()


@router.get(
    "/provider/github/{org}/repos",
    response_description="Get repositories for organization",
    response_model=list[GitHubRepository],
    deprecated=True,
)
async def get_org_repos(org: str, github_client: GithubApi = Depends(get_github_client)):
    return await github_client.get_all_repos_for_org(org=org)


@router.get(
    "/provider/github/repos/{org}/{repo}",
    response_description="Get repository details",
    response_model=GitHubRepository,
    deprecated=True,
)
async def get_repo(org: str, repo: str, github_client: GithubApi = Depends(get_github_client)):
    return await github_client.get_repo(org=org, repo=repo)


@router.get(
    "/provider/github/repos/{org}/{repo}/pulls",
    response_description="Get pull requests for repository",
    response_model=list[GithubPullRequest],
    deprecated=True,
)
async def get_pull_requests(org: str, repo: str, github_client: GithubApi = Depends(get_github_client)):
    return await github_client.get_pull_requests(org=org, repo=repo)
