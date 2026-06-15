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
