import { INTEGRATION_FIELDS } from "./fragments";

export const INTEGRATIONS_QUERY = `
  query Integrations($filter: JSON, $sort: [String!], $range: [Int!]) {
    integrations(filter: $filter, sort: $sort, range: $range) {
      ${INTEGRATION_FIELDS}
    }
    integrationsCount(filter: $filter)
  }
`;

export const INTEGRATION_OIDC_QUERY = `
  query IntegrationOidc($id: UUID!) {
    integrationOidc(id: $id) {
      issuerUrl
      jwksUrl
      audience
      jwksFilename
      jwksContentBase64
    }
  }
`;

export const CONTAINER_REGISTRY_IMAGES_QUERY = `
  query ContainerRegistryImages($integrationId: UUID!, $repositoryFilter: String) {
    containerRegistryImages(
      integrationId: $integrationId
      repositoryFilter: $repositoryFilter
    )
  }
`;
