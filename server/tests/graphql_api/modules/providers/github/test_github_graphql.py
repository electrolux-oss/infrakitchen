from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from application.providers.github.schema import GitHubRepository, GithubOrganization, GithubPullRequest
from graphql_api.schema import schema

GITHUB_ORGANIZATIONS_QUERY = """
    query GithubOrganizations($integrationId: UUID) {
        githubOrganizations(integrationId: $integrationId)
    }
"""

GITHUB_REPOS_QUERY = """
    query GithubRepos($integrationId: UUID, $org: String!) {
        githubRepos(integrationId: $integrationId, org: $org)
    }
"""

GITHUB_REPO_QUERY = """
    query GithubRepo($integrationId: UUID, $org: String!, $repo: String!) {
        githubRepo(integrationId: $integrationId, org: $org, repo: $repo)
    }
"""

GITHUB_PULL_REQUESTS_QUERY = """
    query GithubPullRequests($integrationId: UUID, $org: String!, $repo: String!) {
        githubPullRequests(integrationId: $integrationId, org: $org, repo: $repo)
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
    async def test_github_organizations_returns_organizations(self, mock_get_client, mocked_user):
        mock_get_client.return_value = Mock(
            get_user_orgs=AsyncMock(
                return_value=[
                    GithubOrganization.model_validate(
                        {
                            "login": "acme",
                            "id": 1,
                            "node_id": "ORG_1",
                            "url": "https://api.github.com/orgs/acme",
                            "repos_url": "https://api.github.com/orgs/acme/repos",
                            "events_url": "https://api.github.com/orgs/acme/events",
                            "hooks_url": "https://api.github.com/orgs/acme/hooks",
                            "issues_url": "https://api.github.com/orgs/acme/issues",
                            "members_url": "https://api.github.com/orgs/acme/members{/member}",
                            "public_members_url": "https://api.github.com/orgs/acme/public_members{/member}",
                            "avatar_url": "https://avatars.githubusercontent.com/u/1?v=4",
                            "description": "Acme Org",
                        }
                    )
                ]
            )
        )

        result = await schema.execute(
            GITHUB_ORGANIZATIONS_QUERY,
            variable_values={"integrationId": str(uuid4())},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "githubOrganizations": [
                {
                    "login": "acme",
                    "id": 1,
                    "node_id": "ORG_1",
                    "url": "https://api.github.com/orgs/acme",
                    "repos_url": "https://api.github.com/orgs/acme/repos",
                    "events_url": "https://api.github.com/orgs/acme/events",
                    "hooks_url": "https://api.github.com/orgs/acme/hooks",
                    "issues_url": "https://api.github.com/orgs/acme/issues",
                    "members_url": "https://api.github.com/orgs/acme/members{/member}",
                    "public_members_url": "https://api.github.com/orgs/acme/public_members{/member}",
                    "avatar_url": "https://avatars.githubusercontent.com/u/1?v=4",
                    "description": "Acme Org",
                }
            ]
        }

    @pytest.mark.asyncio
    @patch("graphql_api.modules.providers.github.queries.get_github_client")
    async def test_github_repos_returns_repositories(self, mock_get_client, mocked_user):
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
                "topics": ["infra"],
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
        mock_get_client.return_value = Mock(get_all_repos_for_org=AsyncMock(return_value=[repo]))

        result = await schema.execute(
            GITHUB_REPOS_QUERY,
            variable_values={"integrationId": str(uuid4()), "org": "acme"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"githubRepos": [repo.model_dump(mode="json")]}

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

    @pytest.mark.asyncio
    @patch("graphql_api.modules.providers.github.queries.get_github_client")
    async def test_github_pull_requests_returns_pull_requests(self, mock_get_client, mocked_user):
        repo_ref = {
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
            "forks_url": "f1",
            "keys_url": "k1",
            "collaborators_url": "c1",
            "teams_url": "t1",
            "hooks_url": "h1",
            "issue_events_url": "ie1",
            "events_url": "e1",
            "assignees_url": "a1",
            "branches_url": "b1",
            "tags_url": "tg1",
            "blobs_url": "bl1",
            "git_tags_url": "gt1",
            "git_refs_url": "gr1",
            "trees_url": "tr1",
            "statuses_url": "s1",
            "languages_url": "l1",
            "stargazers_url": "sg1",
            "contributors_url": "co1",
            "subscribers_url": "su1",
            "subscription_url": "sb1",
            "commits_url": "cm1",
            "git_commits_url": "gc1",
            "comments_url": "cc1",
            "issue_comment_url": "ic1",
            "contents_url": "ct1",
            "compare_url": "cp1",
            "merges_url": "m1",
            "archive_url": "ar1",
            "downloads_url": "d1",
            "issues_url": "i1",
            "pulls_url": "p1",
            "milestones_url": "ml1",
            "notifications_url": "n1",
            "labels_url": "lb1",
            "releases_url": "r1",
            "deployments_url": "dp1",
            "created_at": "2024-01-01T00:00:00+00:00",
            "updated_at": "2024-01-02T00:00:00+00:00",
            "pushed_at": "2024-01-03T00:00:00+00:00",
            "git_url": "git://github.com/acme/infra.git",
            "ssh_url": "git@github.com:acme/infra.git",
            "clone_url": "https://github.com/acme/infra.git",
            "svn_url": "https://github.com/acme/infra",
            "homepage": None,
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
            "topics": ["infra"],
            "visibility": "public",
            "forks": 4,
            "open_issues": 5,
            "watchers": 3,
            "default_branch": "main",
        }
        pull_request = GithubPullRequest.model_validate(
            {
                "url": "https://api.github.com/repos/acme/infra/pulls/1",
                "id": 1,
                "node_id": "PR_1",
                "html_url": "https://github.com/acme/infra/pull/1",
                "diff_url": "https://github.com/acme/infra/pull/1.diff",
                "patch_url": "https://github.com/acme/infra/pull/1.patch",
                "issue_url": "https://api.github.com/repos/acme/infra/issues/1",
                "commits_url": "https://api.github.com/repos/acme/infra/pulls/1/commits",
                "review_comments_url": "https://api.github.com/repos/acme/infra/pulls/1/comments",
                "review_comment_url": "https://api.github.com/repos/acme/infra/pulls/comments{/number}",
                "comments_url": "https://api.github.com/repos/acme/infra/issues/1/comments",
                "statuses_url": "https://api.github.com/repos/acme/infra/statuses/sha",
                "number": 1,
                "state": "open",
                "locked": False,
                "title": "Update docs",
                "user": _owner(),
                "body": "Description",
                "created_at": datetime(2024, 2, 1, tzinfo=UTC).isoformat(),
                "updated_at": datetime(2024, 2, 2, tzinfo=UTC).isoformat(),
                "closed_at": None,
                "merged_at": None,
                "merge_commit_sha": None,
                "assignee": None,
                "assignees": [],
                "requested_reviewers": [],
                "requested_teams": [],
                "labels": [],
                "draft": False,
                "head": {
                    "label": "octocat:feature",
                    "ref": "feature",
                    "sha": "abc",
                    "user": _owner(),
                    "repo": repo_ref,
                },
                "base": {
                    "label": "acme:main",
                    "ref": "main",
                    "sha": "def",
                    "user": _owner("acme-bot"),
                    "repo": repo_ref,
                },
                "author_association": "CONTRIBUTOR",
                "auto_merge": None,
                "active_lock_reason": None,
            }
        )
        mock_get_client.return_value = Mock(get_pull_requests=AsyncMock(return_value=[pull_request]))

        result = await schema.execute(
            GITHUB_PULL_REQUESTS_QUERY,
            variable_values={"integrationId": str(uuid4()), "org": "acme", "repo": "infra"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"githubPullRequests": [pull_request.model_dump(mode="json")]}
