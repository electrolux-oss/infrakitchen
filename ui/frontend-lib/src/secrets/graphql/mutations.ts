import { CustomSecretConfig } from "../types";

/**
 * Partial payload for updating a single secret field at a time, used by the
 * inline editing controls on the secret overview page.
 *
 * Field names use camelCase to match the backend `SecretUpdateInput` GraphQL type.
 */
export type SecretUpdateFieldInput = Partial<{
  description: string;
  labels: string[];
  secretProvider: string;
  configuration: object | CustomSecretConfig;
}>;

export const UPDATE_SECRET_MUTATION = `
  mutation UpdateSecret($id: UUID!, $input: SecretUpdateInput!) {
    updateSecret(id: $id, input: $input) {
      id
      name
      secretProvider
    }
  }
`;
