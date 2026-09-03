export interface BitbucketOrganization {
  type: string;
  uuid: string;
  name: string;
  slug: string;
  is_private: boolean;
  is_privacy_enforced: boolean;
  links: {
    avatar?: { href: string };
    hooks?: { href: string };
    html?: { href: string };
    html_overview?: { href: string };
    members?: { href: string };
    owners?: { href: string };
    projects?: { href: string };
    repositories?: { href: string };
    snippets?: { href: string };
    self?: { href: string };
  };
  created_on: Date;
  forking_mode: string;
}

export interface RepoLinkHref {
  href: string;
}

export interface RepoCloneLink {
  name: string;
  href: string;
}

export interface BitbucketRepoLinks {
  self: RepoLinkHref;
  html: RepoLinkHref;
  avatar: RepoLinkHref;
  pullrequests?: RepoLinkHref;
  commits?: RepoLinkHref;
  forks?: RepoLinkHref;
  watchers?: RepoLinkHref;
  branches?: RepoLinkHref;
  tags?: RepoLinkHref;
  downloads?: RepoLinkHref;
  source?: RepoLinkHref;
  clone: RepoCloneLink[];
  hooks?: RepoLinkHref;
}

export interface BitbucketOwnerLinks {
  self: RepoLinkHref;
  avatar: RepoLinkHref;
  html: RepoLinkHref;
}

export interface BitbucketOwner {
  display_name: string;
  links: BitbucketOwnerLinks;
  type: string;
  uuid: string;
  username: string;
}

export interface BitbucketWorkspaceLinks {
  avatar: RepoLinkHref;
  html: RepoLinkHref;
  self: RepoLinkHref;
}

export interface BitbucketWorkspace {
  type: string;
  uuid: string;
  name: string;
  slug: string;
  links: BitbucketWorkspaceLinks;
}

export interface BitbucketProjectLinks {
  self: RepoLinkHref;
  html: RepoLinkHref;
  avatar: RepoLinkHref;
}

export interface BitbucketProject {
  type: string;
  key: string;
  uuid: string;
  name: string;
  links: BitbucketProjectLinks;
}

export interface BitbucketMainBranch {
  name: string;
  type: string;
}

export interface BitbucketOverrideSettings {
  default_merge_strategy: boolean;
  branching_model: boolean;
}

export interface BitbucketRepo {
  type: string;
  full_name: string;
  links: BitbucketRepoLinks;
  name: string;
  slug: string;
  description: string | null;
  scm: string;
  website: string | null;
  owner: BitbucketOwner;
  workspace: BitbucketWorkspace;
  is_private: boolean;
  project: BitbucketProject;
  fork_policy: string;
  created_on: string;
  updated_on: string;
  size: number;
  language: string | null;
  uuid: string;
  mainbranch: BitbucketMainBranch | null;
  override_settings: BitbucketOverrideSettings | null;
  parent: any | null;
  enforced_signed_commits: any | null;
  has_issues: boolean;
  has_wiki: boolean;
}
