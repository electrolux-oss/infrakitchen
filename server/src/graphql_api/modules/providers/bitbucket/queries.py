import uuid
from typing import cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.providers.bitbucket.bitbucket_integration import get_bitbucket_client
from graphql_api.helpers import IsAuthenticated


@strawberry.type
class BitbucketQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def bitbucket_organizations(
        self,
        info: Info,
        integration_id: uuid.UUID | None = None,
    ) -> list[JSON]:
        client = await get_bitbucket_client(integration_id, info.context["session"])
        return cast(list[JSON], [org.model_dump(mode="json") for org in await client.get_user_orgs()])

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def bitbucket_repos(
        self,
        info: Info,
        org: str,
        integration_id: uuid.UUID | None = None,
    ) -> list[JSON]:
        client = await get_bitbucket_client(integration_id, info.context["session"])
        return cast(list[JSON], [repo.model_dump(mode="json") for repo in await client.get_all_repos_for_org(org=org)])

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def bitbucket_repo(
        self,
        info: Info,
        org: str,
        repo: str,
        integration_id: uuid.UUID | None = None,
    ) -> JSON:
        client = await get_bitbucket_client(integration_id, info.context["session"])
        return cast(JSON, cast(object, (await client.get_repo(org=org, repo=repo)).model_dump(mode="json")))

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def bitbucket_pull_requests(
        self,
        info: Info,
        org: str,
        repo: str,
        integration_id: uuid.UUID | None = None,
    ) -> list[JSON]:
        client = await get_bitbucket_client(integration_id, info.context["session"])
        return cast(
            list[JSON],
            [pr.model_dump(mode="json") for pr in await client.get_pull_requests(org=org, repo=repo)],
        )
