import uuid
from typing import cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.providers.azurerm.azure_devops_integration import get_azure_devops_client
from graphql_api.helpers import IsAuthenticated, check_api_permission


@strawberry.type
class AzureDevopsQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def azure_devops_projects(
        self,
        info: Info,
        integration_id: uuid.UUID | None = None,
    ) -> list[JSON]:
        await check_api_permission(info, "integration", ["read"])
        client = await get_azure_devops_client(integration_id, info.context["session"])
        return cast(list[JSON], [project.model_dump(mode="json") for project in await client.get_projects()])

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def azure_devops_repos(
        self,
        info: Info,
        project: str,
        integration_id: uuid.UUID | None = None,
    ) -> list[JSON]:
        await check_api_permission(info, "integration", ["read"])
        client = await get_azure_devops_client(integration_id, info.context["session"])
        repos = await client.get_all_repos_for_project(project=project)
        return cast(
            list[JSON],
            [repo.model_dump(mode="json", by_alias=True) for repo in repos if repo.is_disabled is False],
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def azure_devops_repo(
        self,
        info: Info,
        project: str,
        repo: str,
        integration_id: uuid.UUID | None = None,
    ) -> JSON:
        await check_api_permission(info, "integration", ["read"])
        client = await get_azure_devops_client(integration_id, info.context["session"])
        return cast(
            JSON,
            cast(
                object,
                (await client.get_repo(project=project, repo_id=repo)).model_dump(mode="json"),
            ),
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def azure_devops_pull_requests(
        self,
        info: Info,
        project: str,
        repo: str,
        integration_id: uuid.UUID | None = None,
    ) -> list[JSON]:
        await check_api_permission(info, "integration", ["read"])
        client = await get_azure_devops_client(integration_id, info.context["session"])
        return cast(
            list[JSON],
            [
                pull_request.model_dump(mode="json", by_alias=True)
                for pull_request in await client.get_pull_requests(project=project, repo_id=repo)
            ],
        )
