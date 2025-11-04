from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field, HttpUrl, UUID4


class WorkspaceLink(BaseModel):
    href: HttpUrl


class WorkspaceLinks(BaseModel):
    avatar: WorkspaceLink | None = None
    hooks: WorkspaceLink | None = None
    html: WorkspaceLink | None = None
    html_overview: WorkspaceLink | None = None
    members: WorkspaceLink | None = None
    owners: WorkspaceLink | None = None
    projects: WorkspaceLink | None = None
    repositories: WorkspaceLink | None = None
    snippets: WorkspaceLink | None = None
    self: WorkspaceLink | None = None


class BitbucketOrganization(BaseModel):
    type: str
    uuid: UUID4
    name: str
    slug: str
    is_private: bool | None = None
    is_privacy_enforced: bool | None = None
    links: WorkspaceLinks
    created_on: datetime | None = None
    forking_mode: str | None = None


class RepoLinkHref(BaseModel):
    href: HttpUrl


class RepoCloneLink(BaseModel):
    name: str
    href: HttpUrl | str


class BitbucketRepoLinks(BaseModel):
    self: RepoLinkHref
    html: RepoLinkHref
    avatar: RepoLinkHref
    pullrequests: RepoLinkHref
    commits: RepoLinkHref
    forks: RepoLinkHref
    watchers: RepoLinkHref
    branches: RepoLinkHref
    tags: RepoLinkHref
    downloads: RepoLinkHref
    source: RepoLinkHref
    clone: list[RepoCloneLink]
    hooks: RepoLinkHref


class BitbucketOwnerLinks(BaseModel):
    self: RepoLinkHref
    avatar: RepoLinkHref
    html: RepoLinkHref


class BitbucketOwner(BaseModel):
    display_name: str
    links: BitbucketOwnerLinks
    type: str
    uuid: UUID4
    username: str


class BitbucketProjectLinks(BaseModel):
    self: RepoLinkHref
    html: RepoLinkHref
    avatar: RepoLinkHref


class BitbucketProject(BaseModel):
    type: str
    key: str
    uuid: UUID4
    name: str
    links: BitbucketProjectLinks


class BitbucketMainBranch(BaseModel):
    name: str
    type: str


class BitbucketOverrideSettings(BaseModel):
    default_merge_strategy: bool
    branching_model: bool


class BitbucketRepository(BaseModel):
    type: str
    full_name: str
    links: BitbucketRepoLinks
    name: str
    slug: str
    description: str
    scm: str
    website: HttpUrl | None
    owner: BitbucketOwner
    workspace: BitbucketOrganization
    is_private: bool
    project: BitbucketProject
    fork_policy: str
    created_on: datetime
    updated_on: datetime
    size: int
    language: str
    uuid: UUID4
    mainbranch: BitbucketMainBranch
    override_settings: BitbucketOverrideSettings
    parent: Any | None
    enforced_signed_commits: Any | None
    has_issues: bool
    has_wiki: bool


# Bitbucket pull request
class BitbucketPullRequestLinkHref(BaseModel):
    href: HttpUrl


class BitbucketPullRequestLinks(BaseModel):
    self: BitbucketPullRequestLinkHref | None = None
    html: BitbucketPullRequestLinkHref | None = None
    commits: BitbucketPullRequestLinkHref | None = None
    approve: BitbucketPullRequestLinkHref | None = None
    request_changes: BitbucketPullRequestLinkHref | None = None
    diff: BitbucketPullRequestLinkHref | None = None
    diffstat: BitbucketPullRequestLinkHref | None = None
    comments: BitbucketPullRequestLinkHref | None = None
    activity: BitbucketPullRequestLinkHref | None = None
    merge: BitbucketPullRequestLinkHref | None = None
    decline: BitbucketPullRequestLinkHref | None = None
    statuses: BitbucketPullRequestLinkHref | None = None


class BitbucketPullRequestAuthorLinks(BaseModel):
    self: BitbucketPullRequestLinkHref
    avatar: BitbucketPullRequestLinkHref
    html: BitbucketPullRequestLinkHref


class BitbucketPullRequestAuthor(BaseModel):
    display_name: str
    links: BitbucketPullRequestAuthorLinks
    type: str
    uuid: UUID4
    account_id: str
    nickname: str


class BitbucketPullRequestBranch(BaseModel):
    name: str
    links: Any | None = None  # Links might be empty or missing depending on context


class BitbucketPullRequestCommitLinks(BaseModel):
    self: BitbucketPullRequestLinkHref
    html: BitbucketPullRequestLinkHref


class BitbucketPullRequestCommit(BaseModel):
    hash: str
    links: BitbucketPullRequestCommitLinks
    type: str


class BitbucketPullRequestRepoLinks(BaseModel):
    self: BitbucketPullRequestLinkHref
    html: BitbucketPullRequestLinkHref
    avatar: BitbucketPullRequestLinkHref


class BitbucketPullRequestRepository(BaseModel):
    type: str
    full_name: str
    links: BitbucketPullRequestRepoLinks
    name: str
    uuid: UUID4


class BitbucketPullRequestTarget(BaseModel):
    branch: BitbucketPullRequestBranch
    commit: BitbucketPullRequestCommit
    repository: BitbucketPullRequestRepository


class BitbucketPullRequestSummary(BaseModel):
    type: str
    raw: str
    markup: str
    html: str


class BitbucketPullRequest(BaseModel):
    comment_count: int = Field(alias="comment_count")
    task_count: int = Field(alias="task_count")
    type: Literal["pullrequest"]
    id: int
    title: str
    description: str
    state: Literal["OPEN", "MERGED", "DECLINED", "SUPERSEDED"]
    draft: bool
    merge_commit: Any | None
    close_source_branch: bool
    closed_by: Any | None
    author: BitbucketPullRequestAuthor
    reason: str
    created_on: datetime
    updated_on: datetime
    destination: BitbucketPullRequestTarget
    source: BitbucketPullRequestTarget
    links: BitbucketPullRequestLinks
    summary: BitbucketPullRequestSummary
