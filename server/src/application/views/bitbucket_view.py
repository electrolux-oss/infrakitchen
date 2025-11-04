from fastapi import APIRouter, Depends, HTTPException, Request

from application.integrations.service import IntegrationService
from application.integrations.dependencies import get_integration_service
from application.providers.bitbucket.bitbucket_api import BitbucketApi

from application.providers.bitbucket.schema import BitbucketOrganization, BitbucketPullRequest, BitbucketRepository
from core.adapters.provider_adapters import IntegrationProvider

router = APIRouter()


async def get_bitbucket_client(
    request: Request,
    integration_service: IntegrationService = Depends(get_integration_service),
) -> BitbucketApi:
    integration_id = request.query_params.get("integration_id")
    if not integration_id:
        raise HTTPException(status_code=400, detail="integration_id query parameter is required")

    integration = await integration_service.get_by_id(integration_id)
    if not integration or integration.integration_provider != "bitbucket":
        raise HTTPException(status_code=400, detail="Integration for Bitbucket not found")

    provider_adapter: type[IntegrationProvider] | None = IntegrationProvider.adapters.get("bitbucket")

    if not provider_adapter:
        raise HTTPException(status_code=404, detail="Provider adapter for Bitbucket not found")

    provider_adapter_instance: IntegrationProvider = provider_adapter(**{"configuration": integration.configuration})

    await provider_adapter_instance.authenticate()
    return await provider_adapter_instance.get_api_client()


@router.get(
    "/provider/bitbucket/organizations",
    response_description="Get user organizations",
    # response_model=list[BitbucketOrganization],
    response_model=list[BitbucketOrganization],
)
async def get_user_organizations(bitbucket_client: BitbucketApi = Depends(get_bitbucket_client)):
    return await bitbucket_client.get_user_orgs()


@router.get(
    "/provider/bitbucket/{org}/repos",
    response_description="Get repositories for organization",
    response_model=list[BitbucketRepository],
)
async def get_org_repos(org: str, bitbucket_client: BitbucketApi = Depends(get_bitbucket_client)):
    return await bitbucket_client.get_all_repos_for_org(org=org)


@router.get(
    "/provider/bitbucket/repos/{org}/{repo}",
    response_description="Get repository details",
    response_model=BitbucketRepository,
)
async def get_repo(org: str, repo: str, bitbucket_client: BitbucketApi = Depends(get_bitbucket_client)):
    return await bitbucket_client.get_repo(org=org, repo=repo)


@router.get(
    "/provider/bitbucket/repos/{org}/{repo}/pulls",
    response_description="Get pull requests for repository",
    response_model=list[BitbucketPullRequest],
)
async def get_pull_requests(org: str, repo: str, bitbucket_client: BitbucketApi = Depends(get_bitbucket_client)):
    return await bitbucket_client.get_pull_requests(org=org, repo=repo)
