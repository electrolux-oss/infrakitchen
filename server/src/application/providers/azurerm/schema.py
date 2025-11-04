from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl


class AzureDevOpsProject(BaseModel):
    """
    Pydantic model representing an Azure DevOps Project.
    """

    id: str = Field(...)
    name: str = Field(...)
    description: str | None = Field(default=None)
    url: HttpUrl = Field(...)
    state: str = Field(...)
    revision: int = Field(...)
    visibility: str = Field(...)
    lastUpdateTime: datetime = Field(...)


class AzureDevOpsRepository(BaseModel):
    """
    Pydantic model representing an Azure DevOps Repository.
    """

    id: str = Field(...)
    name: str = Field(...)
    url: HttpUrl = Field(...)
    ssh_url: str = Field(..., alias="sshUrl")
    project: AzureDevOpsProject = Field(...)
    default_branch: str = Field(default="main", alias="defaultBranch")
    size: int | None = Field(default=None)
    remote_url: HttpUrl = Field(..., alias="remoteUrl")
    is_disabled: bool | None = Field(default=None, alias="isDisabled")
    isInMaintenance: bool | None = Field(default=None, alias="isInMaintenance")
    last_update_time: datetime | None = Field(default=None, alias="lastUpdateTime")


class AzureDevOpsProjectRef(BaseModel):
    """
    Pydantic model representing a reference to an Azure DevOps Project.
    Used within other models where only basic project info is needed.
    """

    id: str
    name: str
    state: str
    visibility: str
    lastUpdateTime: datetime


class GitRepositoryRef(BaseModel):
    """
    Pydantic model representing a reference to an Azure DevOps Git Repository.
    """

    id: str
    name: str
    url: HttpUrl
    project: AzureDevOpsProjectRef


class AvatarLink(BaseModel):
    """
    Pydantic model for the avatar link within _links.
    """

    href: HttpUrl


class IdentityLinks(BaseModel):
    """
    Pydantic model for the _links object within an IdentityRef.
    """

    avatar: AvatarLink | None = None


class GitCommitRef(BaseModel):
    """
    Pydantic model representing a reference to a Git Commit.
    """

    commitId: str
    url: HttpUrl


class IdentityRef(BaseModel):
    """
    Pydantic model representing an Azure DevOps Identity (user).
    """

    displayName: str
    url: HttpUrl
    # Use AliasPath to map '_links' from JSON to 'links' in Python
    links: IdentityLinks | None = Field(None, alias="_links")
    id: str
    uniqueName: str
    imageUrl: HttpUrl
    descriptor: str


class AzureDevOpsPullRequest(BaseModel):
    """
    Pydantic model representing an Azure DevOps Pull Request.
    """

    repository: GitRepositoryRef
    pullRequestId: int
    codeReviewId: int
    status: str
    createdBy: IdentityRef
    creationDate: datetime
    title: str
    description: str | None = None
    sourceRefName: str
    targetRefName: str
    mergeStatus: str
    isDraft: bool
    mergeId: str
    lastMergeSourceCommit: GitCommitRef
    lastMergeTargetCommit: GitCommitRef
    lastMergeCommit: GitCommitRef
    reviewers: list[IdentityRef]
    url: HttpUrl
    supportsIterations: bool
