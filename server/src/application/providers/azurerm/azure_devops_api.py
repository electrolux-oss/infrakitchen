from typing import Any

from application.providers.azurerm.schema import AzureDevOpsProject, AzureDevOpsPullRequest, AzureDevOpsRepository
from core.caches.functions import cache_decorator
from .azure_devops_client import AzureDevopsClient


class AzureDevopsApi(AzureDevopsClient):
    def __init__(self, environment_variables: dict[str, str]):
        super().__init__(environment_variables)

    @cache_decorator(avoid_args=True, ttl=3600)
    async def get_projects(self) -> list[AzureDevOpsProject]:
        """
        Fetches all projects in the Azure DevOps organization.

        Returns:
            list[AzureDevOpsProject]: A list of projects in the organization.
        """
        response = await self.get("_apis/projects?api-version=6.0")
        if response.values:
            return [AzureDevOpsProject.model_validate(project) for project in response.values]
        return []

    @cache_decorator(avoid_args=True, ttl=300)
    async def get_all_repos_for_project(self, project: str) -> list[AzureDevOpsRepository]:
        """
        Fetches all repositories for a given Azure DevOps project.

        Args:
            project (str): The project name.

        Returns:
            list[AzureDevOpsRepository]: A list of repositories in the project.
        """
        response = await self.get(f"{project}/_apis/git/repositories?api-version=6.0")
        if response.values:
            return [AzureDevOpsRepository.model_validate(repo) for repo in response.values]
        return []

    async def get_repo(self, project: str, repo_id: str) -> AzureDevOpsRepository:
        """
        Fetches a specific repository for a given Azure DevOps project.

        Args:
            project (str): The project name.
            repo_id (str): The repository ID.

        Returns:
            AzureDevOpsRepository: The repository details.
        """
        response = await self.get(f"{project}/_apis/git/repositories/{repo_id}?api-version=6.0")
        if not response.values:
            raise ValueError(f"Repository {repo_id} not found in project {project}.")

        return AzureDevOpsRepository.model_validate(response.values)

    async def get_pull_requests(
        self, project: str, repo_id: str, params: dict[str, Any] | None = None
    ) -> list[AzureDevOpsPullRequest]:
        """
        Fetches pull requests for a given repository in an Azure DevOps project.

        Args:
            project (str): The project name.
            repo_id (str): The repository ID.
            params (dict[str, Any] | None): Optional parameters for filtering pull requests.

        Returns:
            list[AzureDevOpsPullRequest]: A list of pull requests in the repository.
        """
        if params is None:
            response = await self.get(f"{project}/_apis/git/repositories/{repo_id}/pullrequests?api-version=6.0")
        else:
            response = await self.get(
                f"{project}/_apis/git/repositories/{repo_id}/pullrequests",
                params=params,
            )

        if response.values:
            return [AzureDevOpsPullRequest.model_validate(pr) for pr in response.values]
        return []

    async def get_pull_request(
        self, org: str, repo: str, pr_number: int | None = None, base: str | None = None, head: str | None = None
    ) -> AzureDevOpsPullRequest | None:
        """
        Fetches a specific pull request from a repository in an Azure DevOps project.

        Args:
            org (str): The Azure DevOps project name.
            repo (str): The repository name.
            pr_number (int | None): The pull request number. If None, fetches the latest PR.
            base (str | None): The base branch for the pull request. Optional.
            head (str | None): The head branch for the pull request. Optional.

        Returns:
            AzureDevOpsPullRequest | None: The pull request details or None if not found.
        """
        if pr_number is not None:
            response = await self.get(f"{org}/_apis/git/repositories/{repo}/pullrequests/{pr_number}?api-version=6.0")
            if response.values:
                return AzureDevOpsPullRequest.model_validate(response.values)
        elif base is not None and head is not None:
            # If pr_number is None, fetch the latest pull request
            pulls = await self.get_pull_requests(org, repo)
            if pulls:
                for pr in pulls:
                    if base in pr.targetRefName and head in pr.sourceRefName:
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
            org (str): The Azure DevOps organization name.
            repo (str): The repository name.
            title (str): The title of the pull request.
            body (str): The description of the pull request.
            head (str): The name of the branch where the changes are made.
            base (str): The name of the branch where the changes will be merged. Defaults to "main".

        Returns:
            AzureDevOpsPullRequest: The created pull request details.
        """
        data = {
            "sourceRefName": f"refs/heads/{head}",
            "targetRefName": f"refs/heads/{base}",
            "title": title,
            "description": body,
        }
        response = await self.post(f"{org}/_apis/git/repositories/{repo}/pullrequests?api-version=6.0", data=data)
        if response.status_code == 201:
            return True
        else:
            raise ValueError("Failed to create pull request")

    async def close_pull_request(self, org: str, repo: str, pr_object: AzureDevOpsPullRequest) -> bool:
        """
        Closes a pull request in the specified repository.

        Args:
            org (str): The Azure DevOps project name.
            repo (str): The repository name.
            pr_object (AzureDevOpsPullRequest): The pull request object to close.

        Returns:
            bool: True if the pull request was successfully closed, False otherwise.
        """
        data = {"status": "abandoned"}
        response = await self.patch(
            f"{org}/_apis/git/repositories/{repo}/pullrequests/{pr_object.pullRequestId}?api-version=6.0", data=data
        )
        return response.status_code == 200

    async def merge_pull_request(
        self, org: str, repo: str, pr_object: AzureDevOpsPullRequest, commit_message: str = "Merging pull request"
    ) -> bool:
        """
        Merges a pull request in the specified repository.

        Args:
            org (str): The Azure DevOps project name.
            repo (str): The repository name.
            pr_object (AzureDevOpsPullRequest): The pull request object to merge.
            commit_message (str): The commit message for the merge. Defaults to "Merging pull request".

        Returns:
            bool: True if the pull request was successfully merged, False otherwise.
        """
        data = {
            "status": "completed",
            "completionOptions": {
                "mergeCommitMessage": commit_message,
                "mergeStrategy": "noFastForward",
                "deleteSourceBranch": True,
            },
            "lastMergeSourceCommit": {
                "commitId": pr_object.lastMergeSourceCommit.commitId,
                "url": str(pr_object.lastMergeSourceCommit.url),
            },
        }
        response = await self.patch(
            f"{org}/_apis/git/repositories/{repo}/pullrequests/{pr_object.pullRequestId}?api-version=7.1",
            data=data,
        )
        return response.status_code == 200
