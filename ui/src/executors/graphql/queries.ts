import { EXECUTOR_DETAIL_FIELDS, EXECUTOR_LIST_FIELDS } from "./fragments";

export const EXECUTORS_QUERY = `
  query Executors($filter: JSON, $sort: [String!], $range: [Int!]) {
    executors(filter: $filter, sort: $sort, range: $range) {
      ${EXECUTOR_LIST_FIELDS}
    }
    executorsCount(filter: $filter)
  }
`;

export const EXECUTOR_QUERY = `
  query Executor($id: UUID!) {
    executor(id: $id) {
      ${EXECUTOR_DETAIL_FIELDS}
    }
  }
`;
