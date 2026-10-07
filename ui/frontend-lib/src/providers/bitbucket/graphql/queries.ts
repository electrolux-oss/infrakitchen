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
