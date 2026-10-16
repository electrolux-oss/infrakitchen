import { USER_FIELDS } from "./fragments";

export const USERS_SHORT_QUERY = `
  query UsersShort($sort: [String!], $range: [Int!]) {
    users(sort: $sort, range: $range) {
      id
      identifier
      provider
      displayName
      entityName
    }
  }
`;

export const USER_QUERY = `
  query User($id: UUID!) {
    user(id: $id) {
      ${USER_FIELDS}
    }
  }
`;
