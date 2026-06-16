export type IntegrationUpdateFieldInput = Partial<{
  name: string;
  description: string;
  labels: string[];
  configuration: object;
}>;

export const UPDATE_INTEGRATION_MUTATION = `
  mutation UpdateIntegration($id: UUID!, $input: IntegrationUpdateInput!) {
    updateIntegration(id: $id, input: $input) {
      id
      name
      integrationProvider
    }
  }
`;

export const VALIDATE_INTEGRATION_MUTATION = `
  mutation ValidateIntegration($id: UUID!) {
    validateIntegration(id: $id) {
      isValid
      message
    }
  }
`;

export const VALIDATE_INTEGRATION_CONFIG_MUTATION = `
  mutation ValidateIntegrationConfig($input: IntegrationCreateInput!) {
    validateIntegrationConfig(input: $input) {
      isValid
      message
    }
  }
`;
