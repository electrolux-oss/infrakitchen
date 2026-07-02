from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from application.providers.azurerm.schema import AzureDevOpsProject, AzureDevOpsPullRequest, AzureDevOpsRepository
from graphql_api.schema import schema

AZURE_DEVOPS_PROJECTS_QUERY = """
    query AzureDevopsProjects($integrationId: UUID) {
        azureDevopsProjects(integrationId: $integrationId)
    }
"""

AZURE_DEVOPS_REPOS_QUERY = """
    query AzureDevopsRepos($integrationId: UUID, $project: String!) {
        azureDevopsRepos(integrationId: $integrationId, project: $project)
    }
"""

AZURE_DEVOPS_REPO_QUERY = """
    query AzureDevopsRepo($integrationId: UUID, $project: String!, $repo: String!) {
        azureDevopsRepo(integrationId: $integrationId, project: $project, repo: $repo)
    }
"""

AZURE_DEVOPS_PULL_REQUESTS_QUERY = """
    query AzureDevopsPullRequests($integrationId: UUID, $project: String!, $repo: String!) {
        azureDevopsPullRequests(integrationId: $integrationId, project: $project, repo: $repo)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


def _project():
    return AzureDevOpsProject.model_validate(
        {
            "id": "project-id",
            "name": "Infra",
            "description": "Infra project",
            "url": "https://dev.azure.com/acme/Infra",
            "state": "wellFormed",
            "revision": 1,
            "visibility": "private",
            "lastUpdateTime": datetime(2024, 1, 1, tzinfo=UTC).isoformat(),
        }
    )


def _repo(*, is_disabled: bool = False):
    return AzureDevOpsRepository.model_validate(
        {
            "id": "repo-id",
            "name": "infra",
            "url": "https://dev.azure.com/acme/Infra/_git/infra",
            "sshUrl": "git@ssh.dev.azure.com:v3/acme/Infra/infra",
            "project": _project().model_dump(mode="json"),
            "defaultBranch": "refs/heads/main",
            "size": 10,
            "remoteUrl": "https://dev.azure.com/acme/Infra/_git/infra",
            "isDisabled": is_disabled,
            "isInMaintenance": False,
            "lastUpdateTime": datetime(2024, 1, 2, tzinfo=UTC).isoformat(),
        }
    )


def _pull_request():
    return AzureDevOpsPullRequest.model_validate(
        {
            "repository": {
                "id": "repo-id",
                "name": "infra",
                "url": "https://dev.azure.com/acme/Infra/_apis/git/repositories/repo-id",
                "project": {
                    "id": "project-id",
                    "name": "Infra",
                    "state": "wellFormed",
                    "visibility": "private",
                    "lastUpdateTime": datetime(2024, 1, 1, tzinfo=UTC).isoformat(),
                },
            },
            "pullRequestId": 7,
            "codeReviewId": 8,
            "status": "active",
            "createdBy": {
                "displayName": "Acme Bot",
                "url": "https://dev.azure.com/acme/_apis/Identities/bot",
                "_links": {"avatar": {"href": "https://dev.azure.com/acme/_apis/avatar"}},
                "id": "user-id",
                "uniqueName": "acme-bot",
                "imageUrl": "https://dev.azure.com/acme/_apis/image",
                "descriptor": "aad.descriptor",
            },
            "creationDate": datetime(2024, 2, 1, tzinfo=UTC).isoformat(),
            "title": "Update docs",
            "description": "Description",
            "sourceRefName": "refs/heads/feature/docs",
            "targetRefName": "refs/heads/main",
            "mergeStatus": "succeeded",
            "isDraft": False,
            "mergeId": str(uuid4()),
            "lastMergeSourceCommit": {
                "commitId": "abc123",
                "url": "https://dev.azure.com/acme/Infra/_apis/git/repositories/repo-id/commits/abc123",
            },
            "lastMergeTargetCommit": {
                "commitId": "def456",
                "url": "https://dev.azure.com/acme/Infra/_apis/git/repositories/repo-id/commits/def456",
            },
            "lastMergeCommit": {
                "commitId": "ghi789",
                "url": "https://dev.azure.com/acme/Infra/_apis/git/repositories/repo-id/commits/ghi789",
            },
            "reviewers": [
                {
                    "displayName": "Reviewer",
                    "url": "https://dev.azure.com/acme/_apis/Identities/reviewer",
                    "_links": {"avatar": {"href": "https://dev.azure.com/acme/_apis/reviewer/avatar"}},
                    "id": "reviewer-id",
                    "uniqueName": "reviewer",
                    "imageUrl": "https://dev.azure.com/acme/_apis/reviewer/image",
                    "descriptor": "aad.reviewer",
                }
            ],
            "url": "https://dev.azure.com/acme/Infra/_git/infra/pullrequest/7",
            "supportsIterations": True,
        }
    )


class TestAzureDevopsGraphql:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.providers.azure_devops.queries.get_azure_devops_client")
    async def test_azure_devops_projects_returns_projects(self, mock_get_client, mocked_user):
        project = _project()
        mock_get_client.return_value = Mock(get_projects=AsyncMock(return_value=[project]))

        result = await schema.execute(
            AZURE_DEVOPS_PROJECTS_QUERY,
            variable_values={"integrationId": str(uuid4())},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"azureDevopsProjects": [project.model_dump(mode="json")]}

    @pytest.mark.asyncio
    @patch("graphql_api.modules.providers.azure_devops.queries.get_azure_devops_client")
    async def test_azure_devops_repos_filters_disabled_repositories(self, mock_get_client, mocked_user):
        enabled_repo = _repo(is_disabled=False)
        disabled_repo = _repo(is_disabled=True)
        mock_get_client.return_value = Mock(
            get_all_repos_for_project=AsyncMock(return_value=[enabled_repo, disabled_repo])
        )

        result = await schema.execute(
            AZURE_DEVOPS_REPOS_QUERY,
            variable_values={"integrationId": str(uuid4()), "project": "Infra"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"azureDevopsRepos": [enabled_repo.model_dump(mode="json", by_alias=True)]}

    @pytest.mark.asyncio
    @patch("graphql_api.modules.providers.azure_devops.queries.get_azure_devops_client")
    async def test_azure_devops_repo_returns_repository(self, mock_get_client, mocked_user):
        repo = _repo()
        mock_get_client.return_value = Mock(get_repo=AsyncMock(return_value=repo))

        result = await schema.execute(
            AZURE_DEVOPS_REPO_QUERY,
            variable_values={"integrationId": str(uuid4()), "project": "Infra", "repo": "infra"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"azureDevopsRepo": repo.model_dump(mode="json")}

    @pytest.mark.asyncio
    @patch("graphql_api.modules.providers.azure_devops.queries.get_azure_devops_client")
    async def test_azure_devops_pull_requests_returns_pull_requests(self, mock_get_client, mocked_user):
        pull_request = _pull_request()
        mock_get_client.return_value = Mock(get_pull_requests=AsyncMock(return_value=[pull_request]))

        result = await schema.execute(
            AZURE_DEVOPS_PULL_REQUESTS_QUERY,
            variable_values={"integrationId": str(uuid4()), "project": "Infra", "repo": "infra"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"azureDevopsPullRequests": [pull_request.model_dump(mode="json", by_alias=True)]}
