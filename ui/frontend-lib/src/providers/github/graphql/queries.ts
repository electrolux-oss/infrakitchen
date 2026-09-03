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
