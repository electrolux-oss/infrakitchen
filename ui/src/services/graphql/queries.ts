import { SERVICE_LIST_FIELDS } from "./fragments";

// Needs only the service read permission
export const SERVICE_SOURCE_CODE_STATUS_QUERY = `
  query ServiceSourceCodeStatus($id: UUID!) {
    service(id: $id) {
      id
      sourceCode {
        id
        status
        updatedAt
      }
    }
  }
`;

export const SERVICES_QUERY = `
  query Services($filter: JSON, $sort: [String!], $range: [Int!]) {
    services(filter: $filter, sort: $sort, range: $range) {
      ${SERVICE_LIST_FIELDS}
    }
  }
`;
