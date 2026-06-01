import { INTEGRATION_FIELDS } from "./fragments";

export const INTEGRATIONS_QUERY = `
  query Integrations($filter: JSON, $sort: [String!], $range: [Int!]) {
    integrations(filter: $filter, sort: $sort, range: $range) {
      ${INTEGRATION_FIELDS}
    }
    integrationsCount(filter: $filter)
  }
`;
