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

export interface UserDeletionImpactItem {
  table: string;
  count: number;
}

export interface UserDeletionImpact {
  deleted: UserDeletionImpactItem[];
  cleared: UserDeletionImpactItem[];
  blocking: UserDeletionImpactItem[];
}

export const USER_DELETION_IMPACT_QUERY = `
  query UserDeletionImpact($id: UUID!) {
    userDeletionImpact(id: $id) {
      deleted { table count }
      cleared { table count }
      blocking { table count }
    }
  }
`;
