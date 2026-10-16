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
