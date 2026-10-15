import { SERVICE_DETAIL_FIELDS, SERVICE_LIST_FIELDS } from "./fragments";

export const SERVICE_QUERY = `
  query Service($id: UUID!) {
    service(id: $id) {
      ${SERVICE_DETAIL_FIELDS}
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
