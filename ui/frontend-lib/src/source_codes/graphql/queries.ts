import {
  SOURCE_CODE_DETAIL_FIELDS,
  SOURCE_CODE_LIST_FIELDS,
} from "./fragments";

export const SOURCE_CODES_QUERY = `
  query SourceCodes($filter: JSON, $sort: [String!], $range: [Int!]) {
    sourceCodes(filter: $filter, sort: $sort, range: $range) {
      ${SOURCE_CODE_LIST_FIELDS}
    }
    labels: labels(entity: "source_code")
  }
`;

export const SOURCE_CODE_QUERY = `
  query SourceCode($id: UUID!) {
    sourceCode(id: $id) {
      ${SOURCE_CODE_DETAIL_FIELDS}
    }
  }
`;
