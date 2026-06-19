import { AUTH_PROVIDER_FIELDS } from "./fragments";

/**
 * Partial payload for updating a single auth provider field at a time, used by
 * the inline editing controls on the auth provider overview page.
 */
export type AuthProviderUpdateFieldInput = Partial<{
  name: string;
  description: string;
  enabled: boolean;
  filterByDomain: string[];
  configuration: object;
}>;

export const CREATE_AUTH_PROVIDER_MUTATION = `
  mutation CreateAuthProvider($input: AuthProviderCreateInput!) {
    createAuthProvider(input: $input) {
      id
      name
      entityName
    }
  }
`;

export const UPDATE_AUTH_PROVIDER_MUTATION = `
  mutation UpdateAuthProvider($id: UUID!, $input: AuthProviderUpdateInput!) {
    updateAuthProvider(id: $id, input: $input) {
      ${AUTH_PROVIDER_FIELDS}
    }
  }
`;

export const DELETE_AUTH_PROVIDER_MUTATION = `
  mutation DeleteAuthProvider($id: UUID!) {
    deleteAuthProvider(id: $id)
  }
`;
