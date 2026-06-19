export const GITHUB_ORGANIZATIONS_QUERY = `
  query GithubOrganizations($integrationId: UUID) {
    githubOrganizations(integrationId: $integrationId)
  }
`;

export const GITHUB_REPOS_QUERY = `
  query GithubRepos($integrationId: UUID, $org: String!) {
    githubRepos(integrationId: $integrationId, org: $org)
  }
`;

export const GITHUB_REPO_QUERY = `
  query GithubRepo($integrationId: UUID, $org: String!, $repo: String!) {
    githubRepo(integrationId: $integrationId, org: $org, repo: $repo)
  }
`;

export const GITHUB_PULL_REQUESTS_QUERY = `
  query GithubPullRequests($integrationId: UUID, $org: String!, $repo: String!) {
    githubPullRequests(integrationId: $integrationId, org: $org, repo: $repo)
  }
`;
