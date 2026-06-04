import { buildGraphqlFields } from "../../common/graphql/buildGraphqlFields";

import { LOG_DETAIL_FIELDS, LOG_FIELD_MAP } from "./fragments";

export const LOG_QUERY = `
  query Log($id: UUID!) {
    log(id: $id) {
      ${LOG_DETAIL_FIELDS}
    }
  }
`;

export function buildLogsQuery(requestedFields: string[]) {
  return `query Logs($filter: JSON, $sort: [String!], $range: [Int!]) {
    logs(filter: $filter, sort: $sort, range: $range) {
      ${buildGraphqlFields(requestedFields, LOG_FIELD_MAP)}
    }
  }`;
}

export const LOGS_COUNT_QUERY = `
  query LogsCount($filter: JSON) {
    logsCount(filter: $filter)
  }
`;
