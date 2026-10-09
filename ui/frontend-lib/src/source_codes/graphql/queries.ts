import { USER_SHORT_FIELDS } from "../../users/graphql";

import {
  SOURCE_CODE_DETAIL_FIELDS,
  SOURCE_CODE_LIST_FIELDS,
} from "./fragments";

export const SOURCE_CODES_QUERY = `
  query SourceCodes($filter: JSON, $sort: [String!], $range: [Int!]) {
    sourceCodes(filter: $filter, sort: $sort, range: $range) {
      ${SOURCE_CODE_LIST_FIELDS}
    }
  }
`;

export const SOURCE_CODE_QUERY = `
  query SourceCode($id: UUID!) {
    sourceCode(id: $id) {
      ${SOURCE_CODE_DETAIL_FIELDS}
    }
  }
`;

export const SOURCE_CODE_COMMITS_QUERY = `
  query SourceCodeCommits(
    $id: UUID!
    $branch: String
    $range: [Int!]
  ) {
    sourceCodeCommits(
      id: $id
      branch: $branch
      range: $range
    ) {
      sha
      shortSha
      message
      description
      authorName
      authorEmail
      authoredAt
      url
      author { ${USER_SHORT_FIELDS} }
    }
    sourceCodeCommitsCount(
      id: $id
      branch: $branch
    )
  }
`;

export const SOURCE_CODE_COMMIT_INDEX_QUERY = `
  query SourceCodeCommitIndex(
    $id: UUID!
    $sha: String!
    $branch: String
  ) {
    sourceCodeCommitIndex(
      id: $id
      sha: $sha
      branch: $branch
    )
  }
`;
