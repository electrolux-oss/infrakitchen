import { CustomSecretConfig } from "../types";

export const CREATE_SECRET_MUTATION = `
  mutation CreateSecret($input: SecretCreateInput!) {
    createSecret(input: $input) {
      id
      name
    }
  }
`;

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

export const VALIDATE_SECRET_MUTATION = `
  mutation ValidateSecret($id: UUID!) {
    validateSecret(id: $id) {
      isValid
      message
    }
  }
`;

export const VALIDATE_SECRET_CONFIG_MUTATION = `
  mutation ValidateSecretConfig($input: SecretCreateInput!) {
    validateSecretConfig(input: $input) {
      isValid
      message
    }
  }
`;
