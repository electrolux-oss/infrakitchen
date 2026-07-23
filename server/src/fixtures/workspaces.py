from lorem import get_sentence
from pydantic import HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.dependencies import get_integration_service
from application.workspaces.dependencies import get_workspace_service
from application.workspaces.schema import GitHubOwner, GithubWorkspaceMeta, WorkspaceCreate
from core.users.model import UserDTO


async def insert_workspaces(session: AsyncSession, env: str, user: UserDTO):
    integration_service = get_integration_service(session=session)
    workspace_service = get_workspace_service(session=session)

    integrations = await integration_service.get_all(
        filter={
            "integration_type": "git",
            "integration_provider": "github",
        }
    )
    assert integrations, "GitHub integration not found"

    workspace = WorkspaceCreate(
        description=get_sentence(),
        workspace_provider="github",
        integration_id=integrations[0].id,
        labels=[f"{env}-label"],
        configuration=GithubWorkspaceMeta(
            name=f"{env}",
            html_url=HttpUrl(f"https://github.com/test-org/{env}"),
            git_url=f"git://github.com/test-org/{env}.git",
            ssh_url=f"git@github.com:test-org/{env}.git",
            url=HttpUrl(f"https://api.github.com/repos/test-org/{env}"),
            created_at="2024-01-01T00:00:00Z",
            updated_at="2024-01-01T00:00:00Z",
            description=get_sentence(),
            owner=GitHubOwner(login="test-org"),
            id=1,
            default_branch="main",
        ),
    )

    return await workspace_service.create_workspace(workspace=workspace, requester=user)
