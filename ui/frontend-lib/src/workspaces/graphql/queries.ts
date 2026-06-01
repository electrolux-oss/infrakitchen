import { WORKSPACE_DETAIL_FIELDS, WORKSPACE_LIST_FIELDS } from "./fragments";

export const WORKSPACES_QUERY = `
  query Workspaces($filter: JSON, $sort: [String!], $range: [Int!]) {
    workspaces(filter: $filter, sort: $sort, range: $range) {
      ${WORKSPACE_LIST_FIELDS}
    }
    workspacesCount(filter: $filter)
  }
`;

export const WORKSPACE_QUERY = `
  query Workspace($id: UUID!) {
    workspace(id: $id) {
      ${WORKSPACE_DETAIL_FIELDS}
    }
  }
`;
