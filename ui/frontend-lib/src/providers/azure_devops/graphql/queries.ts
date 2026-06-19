export const AZURE_DEVOPS_PROJECTS_QUERY = `
  query AzureDevopsProjects($integrationId: UUID) {
    azureDevopsProjects(integrationId: $integrationId)
  }
`;

export const AZURE_DEVOPS_REPOS_QUERY = `
  query AzureDevopsRepos($integrationId: UUID, $project: String!) {
    azureDevopsRepos(integrationId: $integrationId, project: $project)
  }
`;

export const AZURE_DEVOPS_REPO_QUERY = `
  query AzureDevopsRepo($integrationId: UUID, $project: String!, $repo: String!) {
    azureDevopsRepo(integrationId: $integrationId, project: $project, repo: $repo)
  }
`;

export const AZURE_DEVOPS_PULL_REQUESTS_QUERY = `
  query AzureDevopsPullRequests($integrationId: UUID, $project: String!, $repo: String!) {
    azureDevopsPullRequests(integrationId: $integrationId, project: $project, repo: $repo)
  }
`;
