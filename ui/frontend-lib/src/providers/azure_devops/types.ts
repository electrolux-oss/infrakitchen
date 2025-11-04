export interface AzureDevopsProject {
  id: string;
  name: string;
  description?: string | null;
  url: string;
  state: string;
  revision: number;
  visibility: string;
  lastUpdateTime: string;
}

export interface AzureDevopsRepo {
  id: string;
  name: string;
  url: string;
  project: AzureDevopsProject;
  description?: string | null;
  remoteUrl?: string | null;
  size?: number | null;
  default_branch?: string | null;
  isDisabled?: boolean;
}

export interface AzureDevOpsProjectRef {
  id: string;
  name: string;
  state: string;
  visibility: string;
  lastUpdateTime: string;
}

export interface GitRepositoryRef {
  id: string;
  name: string;
  url: string;
  project: AzureDevOpsProjectRef;
}

export interface AvatarLink {
  href: string;
}

export interface IdentityLinks {
  avatar?: AvatarLink | null;
}

export interface GitCommitRef {
  commitId: string;
  url: string;
}

export interface IdentityRef {
  displayName: string;
  url: string;
  _links?: IdentityLinks | null;
  id: string;
  uniqueName: string;
  imageUrl: string;
  descriptor: string;
}

export interface AzureDevopsPullRequest {
  repository: GitRepositoryRef;
  pullRequestId: number;
  codeReviewId: number;
  status: string;
  createdBy: IdentityRef;
  creationDate: string;
  title: string;
  description?: string | null;
  sourceRefName: string;
  targetRefName: string;
  mergeStatus: string;
  isDraft: boolean;
  mergeId: string;
  lastMergeSourceCommit: GitCommitRef;
  lastMergeTargetCommit: GitCommitRef;
  lastMergeCommit: GitCommitRef;
  reviewers: IdentityRef[];
  url: string;
  supportsIterations: boolean;
}
