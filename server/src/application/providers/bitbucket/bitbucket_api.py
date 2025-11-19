from typing import Any

from core.caches.functions import cache_decorator
from .bitbucket_client import BitbucketClient
from .schema import BitbucketOrganization, BitbucketPullRequest, BitbucketRepository


class BitbucketApi(BitbucketClient):
    def __init__(self, environment_variables: dict[str, str]):
        super().__init__(environment_variables)

    async def get_user_orgs(self) -> list[Any]:
        result = await self.get("workspaces")
        if result.values:
            return [BitbucketOrganization.model_validate(org) for org in result.values]
        return []

    @cache_decorator(avoid_args=True, ttl=300)  # Cache for 5 minutes
    async def get_all_repos_for_org(self, org: str) -> list[BitbucketRepository]:
        """
        Fetches repositories for a given organization.

        Args:
            org (str): The organization name.

        Returns:
            list[BitbucketRepository]: A list of repositories in the organization.
        """
        all_repos_data: list[dict[str, Any]] = []
        repos_per_page = 100
        next_page_url: str | None = f"repositories/{org}?pagelen={repos_per_page}"
        while next_page_url:
            response = await self.get(next_page_url)
            size = response.size or 0
            page = response.page or 1
            if not response.values:
                break  # No more items on this page, or no more pages

            all_repos_data.extend(response.values)
            if page * repos_per_page >= size:
                break
            next_page_url = f"repositories/{org}?pagelen={repos_per_page}&page={page + 1}"

        return [BitbucketRepository.model_validate(repo) for repo in all_repos_data]

    @cache_decorator(avoid_args=True, ttl=300)  # Cache for 5 minutes
    async def get_repo(self, org: str, repo: str) -> BitbucketRepository:
        """
        Fetches a specific repository for a given organization.

        Args:
            org (str): The organization name.
            repo (str): The repository name.

        Returns:
            BitbucketRepository: The repository details.
        """
        response = await self.get(f"repositories/{org}/{repo}")
        if not response.values:
            raise ValueError(f"Repository {org}/{repo} not found.")

        return BitbucketRepository.model_validate(response.values[0])

    @cache_decorator(avoid_args=True, ttl=300)  # Cache for 5 minutes
    async def get_pull_requests(
        self, org: str, repo: str, params: dict[str, Any] | None = None
    ) -> list[BitbucketPullRequest]:
        """
        Fetches pull requests for a given repository.

        Args:
            org (str): The organization name.
            repo (str): The repository name.
            params (dict[str, Any] | None): Optional parameters for filtering pull requests.

        Returns:
            list[BitbucketPullRequest]: A list of pull requests in the repository.
        """
        if params is None:
            response = await self.get(f"repositories/{org}/{repo}/pullrequests")
        else:
            response = await self.get(f"repositories/{org}/{repo}/pullrequests", params=params)

        if response.values:
            return [BitbucketPullRequest.model_validate(pr) for pr in response.values]
        return []

    async def get_pull_request(
        self, org: str, repo: str, pr_number: int | None = None, base: str | None = None, head: str | None = None
    ) -> BitbucketPullRequest | None:
        """
        Fetches a specific pull request from the repository.

        Args:
            org (str): The organization name.
            repo (str): The repository name.
            pr_number (int | None): The pull request number. If None, fetches the latest PR.
            base (str | None): The base branch for the pull request. Optional.
            head (str | None): The head branch for the pull request. Optional.

        Returns:
            BitbucketPullRequest: The pull request details.
            None: If no pull request matches the criteria.
        """
        if pr_number is not None:
            response = await self.get(f"repositories/{org}/{repo}/pullrequests/{pr_number}")
            return BitbucketPullRequest.model_validate(response.values[0]) if response.values else None

        elif base is not None and head is not None:
            # If pr_number is None, fetch the latest pull request
            pulls: list[BitbucketPullRequest] = await self.get_pull_requests(org, repo)
            if pulls:
                for pr in pulls:
                    if pr.destination.branch.name == base and pr.source.branch.name == head:
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
            bool: True if the pull request was successfully created, False otherwise.
        """
        data = {
            "title": title,
            "description": body,
            "source": {"branch": {"name": head}},
            "destination": {"branch": {"name": base}},
        }
        response = await self.post(f"repositories/{org}/{repo}/pullrequests", data=data)
        if response.status_code == 201:
            return True

        return False

    async def close_pull_request(self, org: str, repo: str, pr_object: BitbucketPullRequest) -> bool:
        """
        Cancels a pull request in the specified repository.

        Args:
            org (str): The organization name.
            repo (str): The repository name.
            pr_object (BitbucketPullRequest): The pull request object to close.

        Returns:
            bool: True if the pull request was successfully closed, False otherwise.
        """
        response = await self.post(
            f"repositories/{org}/{repo}/pullrequests/{pr_object.id}/decline",
        )
        return response.status_code == 200

    async def merge_pull_request(
        self, org: str, repo: str, pr_object: BitbucketPullRequest, commit_message: str = "Merging pull request"
    ) -> bool:
        """
        Merges a pull request in the specified repository.

        Args:
            org (str): The organization name.
            repo (str): The repository name.
            pr_object (BitbucketPullRequest): The pull request object to merge.
            commit_message (str): The commit message for the merge. Defaults to "Merging pull request".

        Returns:
            bool: True if the pull request was successfully merged, False otherwise.
        """
        data = {"message": commit_message, "type": pr_object.type}
        response = await self.post(f"repositories/{org}/{repo}/pullrequests/{pr_object.id}/merge", data=data)
        return response.status_code == 200
