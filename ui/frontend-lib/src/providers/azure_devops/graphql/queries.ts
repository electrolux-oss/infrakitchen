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
