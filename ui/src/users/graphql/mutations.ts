export const CREATE_USER_MUTATION = `
  mutation CreateUser($input: UserCreateInput!) {
    createUser(input: $input) {
      id
      identifier
      entityName
    }
  }
`;

/**
 * Partial payload for updating a single user field at a time, used by the
 * inline editing controls on the user overview page.
 *
 * Field names match the backend `UserUpdateInput` GraphQL type.
 */
export type UserUpdateFieldInput = Partial<{
  description: string;
  deactivated: boolean;
  password: string;
}>;

export const UPDATE_USER_MUTATION = `
  mutation UpdateUser($id: UUID!, $body: UserUpdateInput!) {
    updateUser(id: $id, body: $body) {
      id
      identifier
      entityName
    }
  }
`;

export const LINK_USER_ACCOUNT_MUTATION = `
  mutation LinkUserAccount($primaryUserId: UUID!, $secondaryUserId: UUID!) {
    linkUserAccount(
      primaryUserId: $primaryUserId
      secondaryUserId: $secondaryUserId
    ) {
      id
      identifier
      entityName
    }
  }
`;

export const UNLINK_USER_ACCOUNT_MUTATION = `
  mutation UnlinkUserAccount($primaryUserId: UUID!, $secondaryUserId: UUID!) {
    unlinkUserAccount(
      primaryUserId: $primaryUserId
      secondaryUserId: $secondaryUserId
    ) {
      id
      identifier
      entityName
    }
  }
`;
