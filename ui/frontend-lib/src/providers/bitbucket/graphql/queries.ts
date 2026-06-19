export const BITBUCKET_ORGANIZATIONS_QUERY = `
  query BitbucketOrganizations($integrationId: UUID) {
    bitbucketOrganizations(integrationId: $integrationId)
  }
`;

export const BITBUCKET_REPOS_QUERY = `
  query BitbucketRepos($integrationId: UUID, $org: String!) {
    bitbucketRepos(integrationId: $integrationId, org: $org)
  }
`;

export const BITBUCKET_REPO_QUERY = `
  query BitbucketRepo($integrationId: UUID, $org: String!, $repo: String!) {
    bitbucketRepo(integrationId: $integrationId, org: $org, repo: $repo)
  }
`;

export const BITBUCKET_PULL_REQUESTS_QUERY = `
  query BitbucketPullRequests($integrationId: UUID, $org: String!, $repo: String!) {
    bitbucketPullRequests(integrationId: $integrationId, org: $org, repo: $repo)
  }
`;
