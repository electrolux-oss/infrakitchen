export interface GithubOrganization {
  login: string;
  id: number;
  node_id: string;
  url: string;
  repos_url: string;
  events_url: string;
  hooks_url: string;
  issues_url: string;
  members_url: string;
  public_members_url: string;
  avatar_url: string;
  description?: string | null;
}

export interface GitHubOwner {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  received_events_url: string;
  type: string;
  user_view_type?: string | null;
  site_admin: boolean;
}

export interface GithubRepo {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubOwner;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  created_at: string; // ISO 8601 string
  updated_at: string; // ISO 8601 string
  pushed_at: string; // ISO 8601 string
  git_url: string;
  ssh_url: string;
  clone_url: string;
  homepage: string | null;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  forks_count: number;
  mirror_url: string | null;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: {
    key: string;
    name: string;
    spdx_id: string;
    url: string;
    node_id: string;
  } | null;
  default_branch: string;
  topics?: string[]; // GitHub API v3 includes topics, useful for display
}

export interface GithubPullRequest {
  url: string;
  id: number;
  node_id: string;
  html_url: string;
  diff_url: string;
  patch_url: string;
  issue_url: string;
  commits_url: string;
  review_comments_url: string;
  review_comment_url: string;
  comments_url: string;
  statuses_url: string;
  number: number;
  state: "open" | "closed" | "all"; // State of the pull request
  locked: boolean;
  title: string;
  user: GitHubOwner;
  body: string | null;
  created_at: string; // ISO 8601 string
  updated_at: string; // ISO 8601 string
  closed_at: string | null; // ISO 8601 string or null
  merged_at: string | null; // ISO 8601 string or null
  merge_commit_sha: string | null;
  assignee: any; // Can be more specific if needed
  assignees: any[];
  requested_reviewers: any[];
  requested_teams: any[];
  labels: any[];
  milestone: any;
  draft: boolean;
  changed_files: number;
  head: {
    label: string;
    ref: string;
    sha: string;
    user: any;
    repo: any;
  };
  base: {
    label: string;
    ref: string;
    sha: string;
    user: any;
    repo: any;
  };
  author_association: string;
  auto_merge: boolean | null;
  active_lock_reason: string | null;
}
