import uuid

from fastapi import APIRouter, Depends, HTTPException, Request

from application.providers.bitbucket.bitbucket_api import BitbucketApi
from application.providers.bitbucket.bitbucket_integration import (
    get_bitbucket_client as get_bitbucket_client_for_integration,
)
from application.providers.bitbucket.schema import BitbucketOrganization, BitbucketPullRequest, BitbucketRepository

router = APIRouter()


async def get_bitbucket_client(
    request: Request,
) -> BitbucketApi:
    integration_id = request.query_params.get("integration_id")
    if not integration_id:
        raise HTTPException(status_code=400, detail="integration_id query parameter is required")
    try:
        return await get_bitbucket_client_for_integration(uuid.UUID(integration_id), request.state.session)
    except ValueError as exc:
        detail = str(exc)
        if "badly formed" in detail:
            raise HTTPException(status_code=400, detail="integration_id query parameter is invalid") from exc
        status_code = 404 if "Provider adapter" in detail else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.get(
    "/provider/bitbucket/organizations",
    response_description="Get user organizations",
    response_model=list[BitbucketOrganization],
    deprecated=True,
)
async def get_user_organizations(bitbucket_client: BitbucketApi = Depends(get_bitbucket_client)):
    return await bitbucket_client.get_user_orgs()


@router.get(
    "/provider/bitbucket/{org}/repos",
    response_description="Get repositories for organization",
    response_model=list[BitbucketRepository],
    deprecated=True,
)
async def get_org_repos(org: str, bitbucket_client: BitbucketApi = Depends(get_bitbucket_client)):
    return await bitbucket_client.get_all_repos_for_org(org=org)


@router.get(
    "/provider/bitbucket/repos/{org}/{repo}",
    response_description="Get repository details",
    response_model=BitbucketRepository,
    deprecated=True,
)
async def get_repo(org: str, repo: str, bitbucket_client: BitbucketApi = Depends(get_bitbucket_client)):
    return await bitbucket_client.get_repo(org=org, repo=repo)


@router.get(
    "/provider/bitbucket/repos/{org}/{repo}/pulls",
    response_description="Get pull requests for repository",
    response_model=list[BitbucketPullRequest],
    deprecated=True,
)
async def get_pull_requests(org: str, repo: str, bitbucket_client: BitbucketApi = Depends(get_bitbucket_client)):
    return await bitbucket_client.get_pull_requests(org=org, repo=repo)
