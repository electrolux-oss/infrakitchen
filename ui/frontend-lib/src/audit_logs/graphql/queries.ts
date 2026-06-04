import { buildGraphqlFields } from "../../common/graphql/buildGraphqlFields";

import { AUDIT_LOG_FIELD_MAP } from "./fragments";

export function buildAuditLogsQuery(requestedFields: string[]) {
  return `query AuditLogs($filter: JSON, $sort: [String!], $range: [Int!]) {
    auditLogs(filter: $filter, sort: $sort, range: $range) {
      ${buildGraphqlFields(requestedFields, AUDIT_LOG_FIELD_MAP)}
    }
  }`;
}

export const AUDIT_LOG_ACTIONS_QUERY = `
  query AuditLogActions {
    auditLogActions
  }
`;
