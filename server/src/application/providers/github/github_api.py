from typing import Any

from core.caches.functions import cache_decorator
from .github_client import GithubClient
from .schema import GitHubRepository, GithubOrganization, GithubPullRequest


class GithubApi(GithubClient):
    def __init__(self, environment_variables: dict[str, str]):
        super().__init__(environment_variables)

    def _parse_link_header(self, link_header: str) -> dict[str, str]:
        """
        Parses the HTTP Link header to extract next, prev, first, last URLs.
        Example: <https://api.github.com/organizations/123/repos?page=2>; rel="next",
                 <https://api.github.com/organizations/123/repos?page=1>; rel="prev"
        """
        links = {}
        parts = link_header.split(",")
        for part in parts:
            segment, rel = part.split(";")
            url = segment.strip().strip("<>")
            rel_name = rel.strip().split("=")[1].strip('"')
            links[rel_name] = url
        return links

    @cache_decorator(avoid_args=True, ttl=3600)  # Cache for 1 hour
    async def get_user_orgs(self) -> list[GithubOrganization]:
        result = await self.get("user/orgs")
        if result.values:
            return [GithubOrganization.model_validate(org) for org in result.values]
        return []

    @cache_decorator(avoid_args=True, ttl=300)  # Cache for 5 minutes
    async def get_all_repos_for_org(self, org: str) -> list[GitHubRepository]:
        """
        Fetches repositories for a given organization.

        Args:
            org (str): The organization name.

        Returns:
            list[GitHubRepository]: A list of repositories in the organization.
        """
        all_repos_data: list[dict[str, Any]] = []
        next_page_url: str | None = f"orgs/{org}/repos?type=all&per_page=100"  # Start with first page

        while next_page_url:
            response = await self.get(next_page_url)

            current_page_repos = response.values or []
            if not current_page_repos:
                # No more items on this page, or no more pages
                break

            assert isinstance(current_page_repos, list), "Expected a list of repositories"

            all_repos_data.extend(current_page_repos)

            # Check the Link header for the next page URL
            link_header = response.headers.get("link")
            next_page_url = None
            if link_header:
                links = self._parse_link_header(link_header)
                if "next" in links:
                    # Extract only the path part for self.get, or the full URL for client.get
                    # For simplicity with self.get, let's assume it can handle the full URL for pagination
                    # or adjust self.get to take full URLs.
                    # Best practice: if you get full URL from 'Link' header, use client.get directly.
                    next_page_url = links["next"].replace(f"{self.base_url}/", "")  # Remove base_url prefix

        if all_repos_data:
            return [GitHubRepository.model_validate(repo) for repo in all_repos_data]
        return []

    async def get_repo(self, org: str, repo: str) -> GitHubRepository:
        """
        Fetches a specific repository for a given organization.

        Args:
            org (str): The organization name.
            repo (str): The repository name.

        Returns:
            GitHubRepository: The repository details.
        """
        response = await self.get(f"repos/{org}/{repo}")
        if not response.values:
            raise ValueError(f"Repository {org}/{repo} not found.")

        return GitHubRepository.model_validate(response.values)

    async def get_pull_requests(
        self, org: str, repo: str, params: dict[str, Any] | None = None
    ) -> list[GithubPullRequest]:
        """
        Fetches pull requests for a given repository.

        Args:
            org (str): The organization name.
            repo (str): The repository name.

        Returns:
            list[dict[str, Any]]: A list of pull requests in the repository.
        """
        if params is None:
            response = await self.get(f"repos/{org}/{repo}/pulls")
        else:
            response = await self.get(f"repos/{org}/{repo}/pulls", params=params)

        if response.values:
            assert isinstance(response.values, list), "Expected a list of pull requests"
            return [GithubPullRequest.model_validate(pr) for pr in response.values]
        return []

    async def get_pull_request(
        self, org: str, repo: str, pr_number: int | None = None, base: str | None = None, head: str | None = None
    ) -> GithubPullRequest | None:
        """
        Fetches a specific pull request from the repository.

        Args:
            org (str): The organization name.
            repo (str): The repository name.
            pr_number (int | None): The pull request number. If None, fetches the latest PR.
            base (str | None): The base branch for the pull request. Optional.
            head (str | None): The head branch for the pull request. Optional.

        Returns:
            GithubPullRequest: The pull request details.
            None: If no pull request matches the criteria.
        """
        if pr_number is not None:
            response = await self.get(f"repos/{org}/{repo}/pulls/{pr_number}")
            return GithubPullRequest.model_validate(response.values)
        elif base is not None and head is not None:
            # If pr_number is None, fetch the latest pull request
            pulls = await self.get_pull_requests(
                org, repo, params={"state": "open", "sort": "created", "direction": "desc"}
            )
            if pulls:
                for pr in pulls:
                    if pr.base.ref == base and pr.head.ref == head:
                        return pr
        return None

    async def create_pull_request(
        self,
        org: str,
        repo: str,
        title: str,
        body: str,
        head: str,
        base: str = "main",
    ) -> bool:
        """
        Creates a pull request in the specified repository.

        Args:
            org (str): The organization name.
            repo (str): The repository name.
            title (str): The title of the pull request.
            body (str): The body of the pull request.
            head (str): The branch to merge from.
            base (str): The branch to merge into. Defaults to "main".

        Returns:
            GithubPullRequest: The created pull request details.
        """
        data = {
            "title": title,
            "body": body,
            "head": head,
            "base": base,
        }
        response = await self.post(f"repos/{org}/{repo}/pulls", data=data)
        if response.status_code == 201:
            return True

        return False

    async def close_pull_request(self, org: str, repo: str, pr_object: GithubPullRequest) -> bool:
        """
        Cancels a pull request in the specified repository.

        Args:
            org (str): The organization name.
            repo (str): The repository name.
            pr_object (GithubPullRequest): The pull request object to close.

        Returns:
            bool: True if the pull request was successfully closed, False otherwise.
        """
        response = await self.patch(f"repos/{org}/{repo}/pulls/{pr_object.number}", data={"state": "closed"})
        return response.status_code == 200

    async def merge_pull_request(
        self, org: str, repo: str, pr_object: GithubPullRequest, commit_message: str = "Merging pull request"
    ) -> bool:
        """
        Merges a pull request in the specified repository.

        Args:
            org (str): The organization name.
            repo (str): The repository name.
            pr_object (GithubPullRequest): The pull request object to merge.
            commit_message (str): The commit message for the merge. Defaults to "Merging pull request".

        Returns:
            bool: True if the pull request was successfully merged, False otherwise.
        """
        data = {"commit_message": commit_message}
        response = await self.put(f"repos/{org}/{repo}/pulls/{pr_object.number}/merge", data=data)
        return response.status_code == 200
