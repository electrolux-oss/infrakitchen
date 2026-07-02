from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from application.providers.bitbucket.schema import BitbucketOrganization, BitbucketPullRequest, BitbucketRepository
from graphql_api.schema import schema

BITBUCKET_ORGANIZATIONS_QUERY = """
    query BitbucketOrganizations($integrationId: UUID) {
        bitbucketOrganizations(integrationId: $integrationId)
    }
"""

BITBUCKET_REPOS_QUERY = """
    query BitbucketRepos($integrationId: UUID, $org: String!) {
        bitbucketRepos(integrationId: $integrationId, org: $org)
    }
"""

BITBUCKET_REPO_QUERY = """
    query BitbucketRepo($integrationId: UUID, $org: String!, $repo: String!) {
        bitbucketRepo(integrationId: $integrationId, org: $org, repo: $repo)
    }
"""

BITBUCKET_PULL_REQUESTS_QUERY = """
    query BitbucketPullRequests($integrationId: UUID, $org: String!, $repo: String!) {
        bitbucketPullRequests(integrationId: $integrationId, org: $org, repo: $repo)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


def _organization():
    return BitbucketOrganization.model_validate(
        {
            "type": "workspace",
            "uuid": str(uuid4()),
            "name": "Acme Workspace",
            "slug": "acme",
            "is_private": False,
            "is_privacy_enforced": False,
            "links": {
                "avatar": {"href": "https://bitbucket.org/account/acme/avatar/"},
                "html": {"href": "https://bitbucket.org/acme/"},
                "self": {"href": "https://api.bitbucket.org/2.0/workspaces/acme"},
            },
            "created_on": datetime(2024, 1, 1, tzinfo=UTC).isoformat(),
            "forking_mode": "allow_forks",
        }
    )


def _repository():
    org = _organization()
    return BitbucketRepository.model_validate(
        {
            "type": "repository",
            "full_name": "acme/infra",
            "links": {
                "self": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra"},
                "html": {"href": "https://bitbucket.org/acme/infra"},
                "avatar": {"href": "https://bytebucket.org/ravatar/%7Buuid%7D?ts=1"},
                "pullrequests": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/pullrequests"},
                "commits": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/commits"},
                "forks": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/forks"},
                "watchers": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/watchers"},
                "branches": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/refs/branches"},
                "tags": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/refs/tags"},
                "downloads": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/downloads"},
                "source": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/src"},
                "clone": [
                    {"name": "https", "href": "https://bitbucket.org/acme/infra.git"},
                    {"name": "ssh", "href": "git@bitbucket.org:acme/infra.git"},
                ],
                "hooks": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/hooks"},
            },
            "name": "infra",
            "slug": "infra",
            "description": "Infra repo",
            "scm": "git",
            "website": "https://example.com",
            "owner": {
                "display_name": "Acme Bot",
                "links": {
                    "self": {"href": "https://api.bitbucket.org/2.0/users/acme-bot"},
                    "avatar": {"href": "https://bitbucket.org/account/acme-bot/avatar/"},
                    "html": {"href": "https://bitbucket.org/acme-bot/"},
                },
                "type": "user",
                "uuid": str(uuid4()),
                "username": "acme-bot",
            },
            "workspace": org.model_dump(mode="json"),
            "is_private": False,
            "project": {
                "type": "project",
                "key": "INF",
                "uuid": str(uuid4()),
                "name": "Infra",
                "links": {
                    "self": {"href": "https://api.bitbucket.org/2.0/workspaces/acme/projects/INF"},
                    "html": {"href": "https://bitbucket.org/acme/workspace/projects/INF"},
                    "avatar": {"href": "https://bitbucket.org/account/acme/projects/INF/avatar/32"},
                },
            },
            "fork_policy": "no_public_forks",
            "created_on": datetime(2024, 1, 1, tzinfo=UTC).isoformat(),
            "updated_on": datetime(2024, 1, 2, tzinfo=UTC).isoformat(),
            "size": 1024,
            "language": "Python",
            "uuid": str(uuid4()),
            "mainbranch": {"name": "main", "type": "branch"},
            "override_settings": {"default_merge_strategy": True, "branching_model": False},
            "parent": None,
            "enforced_signed_commits": None,
            "has_issues": True,
            "has_wiki": True,
        }
    )


def _pull_request():
    return BitbucketPullRequest.model_validate(
        {
            "comment_count": 2,
            "task_count": 1,
            "type": "pullrequest",
            "id": 7,
            "title": "Update docs",
            "description": "Description",
            "state": "OPEN",
            "draft": False,
            "merge_commit": None,
            "close_source_branch": False,
            "closed_by": None,
            "author": {
                "display_name": "Acme Bot",
                "links": {
                    "self": {"href": "https://api.bitbucket.org/2.0/users/acme-bot"},
                    "avatar": {"href": "https://bitbucket.org/account/acme-bot/avatar/"},
                    "html": {"href": "https://bitbucket.org/acme-bot/"},
                },
                "type": "user",
                "uuid": str(uuid4()),
                "account_id": "account-id",
                "nickname": "acme-bot",
            },
            "reason": "",
            "created_on": datetime(2024, 2, 1, tzinfo=UTC).isoformat(),
            "updated_on": datetime(2024, 2, 2, tzinfo=UTC).isoformat(),
            "destination": {
                "branch": {"name": "main", "links": None},
                "commit": {
                    "hash": "abc123",
                    "links": {
                        "self": {"href": "https://api.bitbucket.org/2.0/commits/abc123"},
                        "html": {"href": "https://bitbucket.org/acme/infra/commits/abc123"},
                    },
                    "type": "commit",
                },
                "repository": {
                    "type": "repository",
                    "full_name": "acme/infra",
                    "links": {
                        "self": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra"},
                        "html": {"href": "https://bitbucket.org/acme/infra"},
                        "avatar": {"href": "https://bytebucket.org/ravatar/%7Buuid%7D?ts=1"},
                    },
                    "name": "infra",
                    "uuid": str(uuid4()),
                },
            },
            "source": {
                "branch": {"name": "feature/docs", "links": None},
                "commit": {
                    "hash": "def456",
                    "links": {
                        "self": {"href": "https://api.bitbucket.org/2.0/commits/def456"},
                        "html": {"href": "https://bitbucket.org/acme/infra/commits/def456"},
                    },
                    "type": "commit",
                },
                "repository": {
                    "type": "repository",
                    "full_name": "acme/infra",
                    "links": {
                        "self": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra"},
                        "html": {"href": "https://bitbucket.org/acme/infra"},
                        "avatar": {"href": "https://bytebucket.org/ravatar/%7Buuid%7D?ts=1"},
                    },
                    "name": "infra",
                    "uuid": str(uuid4()),
                },
            },
            "links": {
                "self": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/pullrequests/7"},
                "html": {"href": "https://bitbucket.org/acme/infra/pull-requests/7"},
                "commits": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/pullrequests/7/commits"},
                "approve": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/pullrequests/7/approve"},
                "request_changes": {
                    "href": "https://api.bitbucket.org/2.0/repositories/acme/infra/pullrequests/7/request-changes"
                },
                "diff": {
                    "href": "https://api.bitbucket.org/2.0/repositories/acme/infra/diff/acme/infra:abc123..def456"
                },
                "diffstat": {
                    "href": "https://api.bitbucket.org/2.0/repositories/acme/infra/diffstat/acme/infra:abc123..def456"
                },
                "comments": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/pullrequests/7/comments"},
                "activity": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/pullrequests/7/activity"},
                "merge": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/pullrequests/7/merge"},
                "decline": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/pullrequests/7/decline"},
                "statuses": {"href": "https://api.bitbucket.org/2.0/repositories/acme/infra/commit/abc123/statuses"},
            },
            "summary": {
                "type": "rendered",
                "raw": "Summary",
                "markup": "markdown",
                "html": "<p>Summary</p>",
            },
        }
    )


class TestBitbucketGraphql:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.providers.bitbucket.queries.get_bitbucket_client")
    async def test_bitbucket_organizations_returns_organizations(self, mock_get_client, mocked_user):
        organization = _organization()
        mock_get_client.return_value = Mock(get_user_orgs=AsyncMock(return_value=[organization]))

        result = await schema.execute(
            BITBUCKET_ORGANIZATIONS_QUERY,
            variable_values={"integrationId": str(uuid4())},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"bitbucketOrganizations": [organization.model_dump(mode="json")]}

    @pytest.mark.asyncio
    @patch("graphql_api.modules.providers.bitbucket.queries.get_bitbucket_client")
    async def test_bitbucket_repos_returns_repositories(self, mock_get_client, mocked_user):
        repo = _repository()
        mock_get_client.return_value = Mock(get_all_repos_for_org=AsyncMock(return_value=[repo]))

        result = await schema.execute(
            BITBUCKET_REPOS_QUERY,
            variable_values={"integrationId": str(uuid4()), "org": "acme"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"bitbucketRepos": [repo.model_dump(mode="json")]}

    @pytest.mark.asyncio
    @patch("graphql_api.modules.providers.bitbucket.queries.get_bitbucket_client")
    async def test_bitbucket_repo_returns_repository(self, mock_get_client, mocked_user):
        repo = _repository()
        mock_get_client.return_value = Mock(get_repo=AsyncMock(return_value=repo))

        result = await schema.execute(
            BITBUCKET_REPO_QUERY,
            variable_values={"integrationId": str(uuid4()), "org": "acme", "repo": "infra"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"bitbucketRepo": repo.model_dump(mode="json")}

    @pytest.mark.asyncio
    @patch("graphql_api.modules.providers.bitbucket.queries.get_bitbucket_client")
    async def test_bitbucket_pull_requests_returns_pull_requests(self, mock_get_client, mocked_user):
        pull_request = _pull_request()
        mock_get_client.return_value = Mock(get_pull_requests=AsyncMock(return_value=[pull_request]))

        result = await schema.execute(
            BITBUCKET_PULL_REQUESTS_QUERY,
            variable_values={"integrationId": str(uuid4()), "org": "acme", "repo": "infra"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"bitbucketPullRequests": [pull_request.model_dump(mode="json")]}
