import uuid
from typing import cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.providers.github.github_integration import get_github_client
from graphql_api.helpers import IsAuthenticated, check_api_permission


@strawberry.type
class GithubQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def github_organizations(
        self,
        info: Info,
        integration_id: uuid.UUID | None = None,
    ) -> list[JSON]:
        await check_api_permission(info, "integration", ["read"])
        client = await get_github_client(integration_id, info.context["session"])
        return cast(list[JSON], [org.model_dump(mode="json") for org in await client.get_user_orgs()])

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def github_repos(
        self,
        info: Info,
        org: str,
        integration_id: uuid.UUID | None = None,
    ) -> list[JSON]:
        await check_api_permission(info, "integration", ["read"])
        client = await get_github_client(integration_id, info.context["session"])
        return cast(list[JSON], [repo.model_dump(mode="json") for repo in await client.get_all_repos_for_org(org=org)])

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def github_repo(
        self,
        info: Info,
        org: str,
        repo: str,
        integration_id: uuid.UUID | None = None,
    ) -> JSON:
        await check_api_permission(info, "integration", ["read"])
        client = await get_github_client(integration_id, info.context["session"])
        return cast(JSON, cast(object, (await client.get_repo(org=org, repo=repo)).model_dump(mode="json")))

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def github_pull_requests(
        self,
        info: Info,
        org: str,
        repo: str,
        integration_id: uuid.UUID | None = None,
    ) -> list[JSON]:
        await check_api_permission(info, "integration", ["read"])
        client = await get_github_client(integration_id, info.context["session"])
        return cast(
            list[JSON], [pr.model_dump(mode="json") for pr in await client.get_pull_requests(org=org, repo=repo)]
        )
