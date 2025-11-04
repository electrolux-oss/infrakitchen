from datetime import datetime
import re
from typing import Annotated, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, computed_field

from application.integrations.schema import IntegrationShort

from application.providers.azurerm.schema import AzureDevOpsRepository
from application.providers.bitbucket.schema import (
    BitbucketOrganization,
    RepoCloneLink,
    RepoLinkHref,
)
from core.constants.model import ModelStatus
from core.users.schema import UserShort


# GitHub specific models
class GitHubOwner(BaseModel):
    login: str


class GithubWorkspaceMeta(BaseModel):
    """
    Specific metadata for GitHub workspaces.
    """

    name: str = Field(...)
    html_url: HttpUrl = Field(...)
    git_url: str = Field(default="")
    ssh_url: str = Field(default="")
    url: HttpUrl = Field(...)
    created_at: str = Field(...)
    updated_at: str = Field(...)
    pushed_at: str | None = Field(default=None)
    description: str | None = Field(default=None)
    owner: GitHubOwner = Field(...)

    id: int = Field(...)
    default_branch: str = Field(default="main")
    workspace_provider: Literal["github"] = Field(default="github", frozen=True)


# Bitbucket specific models
class BitbucketMainBranch(BaseModel):
    name: str
    type: str


class BitbucketRepoLinks(BaseModel):
    html: RepoLinkHref
    clone: list[RepoCloneLink]


class BitbucketWorkspaceMeta(BaseModel):
    """
    Specific metadata for Bitbucket workspaces.
    """

    links: BitbucketRepoLinks = Field(...)
    name: str = Field(...)
    slug: str = Field(...)
    description: str | None = None
    workspace: BitbucketOrganization = Field(...)
    created_on: datetime = Field(...)
    updated_on: datetime = Field(...)
    mainbranch: BitbucketMainBranch = Field(...)
    workspace_provider: Literal["bitbucket"] = Field(default="bitbucket", frozen=True)


class AzureDevOpsWorkspaceMeta(AzureDevOpsRepository):
    """
    Specific metadata for Azure DevOps workspaces.
    """

    workspace_provider: Literal["azure_devops"] = Field(default="azure_devops", frozen=True)


class WorkspaceMeta(BaseModel):
    """
    Metadata for workspaces, can be either GitHub or Bitbucket.
    """

    name: str
    url: HttpUrl
    description: str | None = None
    ssh_url: str
    https_url: HttpUrl
    default_branch: str = Field(default="main")
    organization: str | None = None

    @classmethod
    def from_github_meta(cls, github_meta: GithubWorkspaceMeta) -> "WorkspaceMeta":
        """
        Adapts data from GithubWorkspaceMeta to WorkspaceMeta.
        """
        return cls(
            name=github_meta.name,
            url=github_meta.url,
            description=github_meta.description,
            ssh_url=github_meta.ssh_url,
            https_url=github_meta.html_url,  # Mapping html_url from GitHub to https_url
            default_branch=github_meta.default_branch,
            organization=github_meta.owner.login,  # Mapping owner.login to organization
        )

    @classmethod
    def from_bitbucket_meta(cls, bitbucket_meta: BitbucketWorkspaceMeta) -> "WorkspaceMeta":
        """
        Adapts data from BitbucketWorkspaceMeta to WorkspaceMeta.
        """
        clone_links = bitbucket_meta.links.clone
        ssh_url: str = str(next((link.href for link in clone_links if link.name == "ssh"), ""))
        https_url = str(next((link.href for link in clone_links if link.name == "https"), ""))
        if "@" in https_url:
            # Remove username from https_url if present
            https_url = re.sub(r"https://[^/]+@", "https://", https_url)

        return cls(
            name=bitbucket_meta.name,
            url=bitbucket_meta.links.html.href,
            description=bitbucket_meta.description,
            ssh_url=ssh_url,
            https_url=HttpUrl(https_url),
            default_branch=bitbucket_meta.mainbranch.name,
            organization=bitbucket_meta.workspace.slug,  # Mapping workspace.slug to organization
        )

    @classmethod
    def from_azure_devops_meta(cls, azure_meta: AzureDevOpsWorkspaceMeta) -> "WorkspaceMeta":
        """
        Adapts data from AzureDevOpsWorkspaceMeta to WorkspaceMeta.
        """
        https_url = str(azure_meta.remote_url)
        if "@" in https_url:
            # Remove username from https_url if present, for Azure DevOps uses org name as username
            https_url = re.sub(r"https://[^/]+@", "https://", https_url)

        default_branch = azure_meta.default_branch
        if "refs/heads/" in default_branch:
            # Extract branch name from refs/heads/
            default_branch = default_branch.split("refs/heads/")[-1]

        return cls(
            name=azure_meta.name,
            url=azure_meta.url,
            ssh_url=azure_meta.ssh_url,
            https_url=HttpUrl(https_url),
            default_branch=default_branch,
            organization=azure_meta.project.id,
        )


class WorkspaceResponse(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    creator: UserShort = Field()

    name: str = Field(...)
    description: str = Field(default="")
    workspace_provider: Literal["github", "bitbucket", "azure_devops"] = Field(..., frozen=True)
    integration: IntegrationShort = Field(...)
    labels: list[str] = Field(default_factory=list)

    status: Literal[
        ModelStatus.IN_PROGRESS,
        ModelStatus.DONE,
        ModelStatus.ERROR,
    ] = Field(default=ModelStatus.DONE)

    configuration: WorkspaceMeta = Field(...)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "workspace"


class WorkspaceCreate(BaseModel):
    description: str = Field(default="")
    workspace_provider: Literal["github", "bitbucket", "azure_devops"] = Field(..., frozen=True)
    integration_id: uuid.UUID = Field(..., frozen=True)
    labels: list[str] = Field(default_factory=list)

    configuration: Annotated[
        GithubWorkspaceMeta | BitbucketWorkspaceMeta | AzureDevOpsWorkspaceMeta,
        Field(discriminator="workspace_provider"),
    ] = Field(...)


class WorkspaceUpdate(BaseModel):
    description: str | None = Field(default=None)
    labels: list[str] = Field(default_factory=list)


class WorkspaceShort(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(...)
    workspace_provider: Literal["github", "bitbucket", "azure_devops"] = Field(...)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "workspace"
