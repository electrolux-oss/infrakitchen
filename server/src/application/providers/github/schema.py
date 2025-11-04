from typing import Any, Literal
from pydantic import BaseModel, HttpUrl
from datetime import datetime


class GithubOrganization(BaseModel):
    """
    Pydantic model representing a GitHub Organization.
    """

    login: str
    id: int
    node_id: str
    url: HttpUrl
    repos_url: HttpUrl
    events_url: HttpUrl
    hooks_url: HttpUrl
    issues_url: HttpUrl
    members_url: str
    public_members_url: str
    avatar_url: HttpUrl
    description: str | None = None


class GitHubOwner(BaseModel):
    """
    Pydantic model representing the owner (User or Organization) of a GitHub repository.
    """

    login: str
    id: int
    node_id: str
    avatar_url: HttpUrl
    gravatar_id: str
    url: HttpUrl
    html_url: HttpUrl
    followers_url: HttpUrl
    subscriptions_url: HttpUrl
    organizations_url: HttpUrl
    repos_url: HttpUrl
    received_events_url: HttpUrl
    type: str  # e.g., "Organization", "User"
    user_view_type: str | None = None  # This field might be specific to some API contexts, making it Optional
    site_admin: bool


class GitHubRepositoryPermissions(BaseModel):
    """
    Pydantic model representing the authenticated user's permissions on a repository.
    """

    admin: bool
    maintain: bool
    push: bool
    triage: bool
    pull: bool


class GitHubRepository(BaseModel):
    """
    Pydantic model representing a GitHub Repository.
    """

    id: int
    node_id: str
    name: str
    full_name: str
    private: bool
    owner: GitHubOwner  # Nested Pydantic model
    html_url: HttpUrl
    description: str | None = None
    fork: bool
    url: HttpUrl

    # Datetime fields
    created_at: datetime
    updated_at: datetime
    pushed_at: datetime

    # Other fields
    git_url: str  # Can be git://, ssh://, https://
    ssh_url: str
    clone_url: HttpUrl
    svn_url: HttpUrl
    size: int
    stargazers_count: int
    watchers_count: int
    language: str | None = None
    has_issues: bool
    has_projects: bool
    has_downloads: bool
    has_wiki: bool
    has_pages: bool
    has_discussions: bool
    forks_count: int
    mirror_url: HttpUrl | None = None
    archived: bool
    disabled: bool
    open_issues_count: int
    license: dict[Any, Any] | None = None
    allow_forking: bool
    is_template: bool
    web_commit_signoff_required: bool
    topics: list[str] = []
    visibility: str  # e.g., 'internal', 'public', 'private'
    forks: int  # Duplicates forks_count, but often present
    open_issues: int  # Duplicates open_issues_count, but often present
    watchers: int  # Duplicates watchers_count, but often present
    default_branch: str
    permissions: GitHubRepositoryPermissions  # Nested Pydantic model
    custom_properties: dict[Any, Any]  # Can be an arbitrary dict


class RepoReference(BaseModel):
    id: int
    node_id: str
    name: str
    full_name: str
    private: bool
    owner: GitHubOwner
    html_url: str
    description: str | None = None
    fork: bool
    url: str
    forks_url: str
    keys_url: str
    collaborators_url: str
    teams_url: str
    hooks_url: str
    issue_events_url: str
    events_url: str
    assignees_url: str
    branches_url: str
    tags_url: str
    blobs_url: str
    git_tags_url: str
    git_refs_url: str
    trees_url: str
    statuses_url: str
    languages_url: str
    stargazers_url: str
    contributors_url: str
    subscribers_url: str
    subscription_url: str
    commits_url: str
    git_commits_url: str
    comments_url: str
    issue_comment_url: str
    contents_url: str
    compare_url: str
    merges_url: str
    archive_url: str
    downloads_url: str
    issues_url: str
    pulls_url: str
    milestones_url: str
    notifications_url: str
    labels_url: str
    releases_url: str
    deployments_url: str
    created_at: str
    updated_at: str
    pushed_at: str
    git_url: str
    ssh_url: str
    clone_url: str
    svn_url: str
    homepage: str | None = None
    size: int
    stargazers_count: int
    watchers_count: int
    language: str | None = None
    has_issues: bool
    has_projects: bool
    has_downloads: bool
    has_wiki: bool
    has_pages: bool
    has_discussions: bool
    forks_count: int
    mirror_url: str | None = None
    archived: bool
    disabled: bool
    open_issues_count: int
    license: dict[str, Any] | None = None
    allow_forking: bool
    is_template: bool
    web_commit_signoff_required: bool
    topics: list[str]
    visibility: str
    forks: int
    open_issues: int
    watchers: int
    default_branch: str


class BranchInfo(BaseModel):
    label: str
    ref: str
    sha: str
    user: GitHubOwner | None = None
    repo: RepoReference | None = None


class GithubPullRequest(BaseModel):
    url: str
    id: int
    node_id: str
    html_url: str
    diff_url: str
    patch_url: str
    issue_url: str
    commits_url: str
    review_comments_url: str
    review_comment_url: str
    comments_url: str
    statuses_url: str
    number: int
    state: Literal["open", "closed", "all"]
    locked: bool
    title: str
    user: GitHubOwner
    body: str | None = None
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None = None
    merged_at: datetime | None = None
    merge_commit_sha: str | None = None
    assignee: GitHubOwner | None = None
    assignees: list[GitHubOwner] = []
    requested_reviewers: list[GitHubOwner] = []
    requested_teams: list[Any] = []
    labels: list[dict[str, Any]] = []
    draft: bool
    head: BranchInfo
    base: BranchInfo
    author_association: str
    auto_merge: bool | None = None
    active_lock_reason: str | None = None
