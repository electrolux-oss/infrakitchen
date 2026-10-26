import { SERVICE_LIST_FIELDS } from "./fragments";

export const SERVICES_QUERY = `
  query Services($filter: JSON, $sort: [String!], $range: [Int!]) {
    services(filter: $filter, sort: $sort, range: $range) {
      ${SERVICE_LIST_FIELDS}
    }
  }
`;
