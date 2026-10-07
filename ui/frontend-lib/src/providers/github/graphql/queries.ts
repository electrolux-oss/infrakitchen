export const GITHUB_REPO_QUERY = `
  query GithubRepo($integrationId: UUID, $org: String!, $repo: String!) {
    githubRepo(integrationId: $integrationId, org: $org, repo: $repo)
  }
`;
