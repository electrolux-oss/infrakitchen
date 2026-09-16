from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from application.providers.github.schema import GitHubRepository
from graphql_api.schema import schema

GITHUB_REPO_QUERY = """
    query GithubRepo($integrationId: UUID, $org: String!, $repo: String!) {
        githubRepo(integrationId: $integrationId, org: $org, repo: $repo)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


def _owner(login: str = "octocat"):
    return {
        "login": login,
        "id": 1,
        "node_id": "NODE_1",
        "avatar_url": "https://example.com/avatar.png",
        "gravatar_id": "",
        "url": "https://api.github.com/users/octocat",
        "html_url": "https://github.com/octocat",
        "followers_url": "https://api.github.com/users/octocat/followers",
        "subscriptions_url": "https://api.github.com/users/octocat/subscriptions",
        "organizations_url": "https://api.github.com/users/octocat/orgs",
        "repos_url": "https://api.github.com/users/octocat/repos",
        "received_events_url": "https://api.github.com/users/octocat/received_events",
        "type": "User",
        "user_view_type": None,
        "site_admin": False,
    }


class TestGithubGraphql:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.providers.github.queries.get_github_client")
    async def test_github_repo_returns_repository(self, mock_get_client, mocked_user):
        repo = GitHubRepository.model_validate(
            {
                "id": 1,
                "node_id": "REPO_1",
                "name": "infra",
                "full_name": "acme/infra",
                "private": False,
                "owner": _owner(),
                "html_url": "https://github.com/acme/infra",
                "description": "Infra repo",
                "fork": False,
                "url": "https://api.github.com/repos/acme/infra",
                "created_at": datetime(2024, 1, 1, tzinfo=UTC).isoformat(),
                "updated_at": datetime(2024, 1, 2, tzinfo=UTC).isoformat(),
                "pushed_at": datetime(2024, 1, 3, tzinfo=UTC).isoformat(),
                "git_url": "git://github.com/acme/infra.git",
                "ssh_url": "git@github.com:acme/infra.git",
                "clone_url": "https://github.com/acme/infra.git",
                "svn_url": "https://github.com/acme/infra",
                "size": 100,
                "stargazers_count": 2,
                "watchers_count": 3,
                "language": "Python",
                "has_issues": True,
                "has_projects": True,
                "has_downloads": True,
                "has_wiki": False,
                "has_pages": False,
                "has_discussions": False,
                "forks_count": 4,
                "mirror_url": None,
                "archived": False,
                "disabled": False,
                "open_issues_count": 5,
                "license": {"name": "MIT", "key": "mit", "spdx_id": "MIT", "url": None, "node_id": "L1"},
                "allow_forking": True,
                "is_template": False,
                "web_commit_signoff_required": False,
                "topics": ["infra", "kitchen"],
                "visibility": "public",
                "forks": 4,
                "open_issues": 5,
                "watchers": 3,
                "default_branch": "main",
                "homepage": None,
                "permissions": {"admin": True, "maintain": False, "push": True, "triage": False, "pull": True},
                "custom_properties": {},
            }
        )
        mock_get_client.return_value = Mock(get_repo=AsyncMock(return_value=repo))

        result = await schema.execute(
            GITHUB_REPO_QUERY,
            variable_values={"integrationId": str(uuid4()), "org": "acme", "repo": "infra"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"githubRepo": repo.model_dump(mode="json")}
