export const CREATE_INTEGRATION_WITH_STORAGE_MUTATION = `
  mutation CreateIntegrationWithStorage($input: IntegrationCreateWithStorageInput!) {
    createIntegrationWithStorage(input: $input) {
      id
      name
      entityName
      integrationProvider
    }
  }
`;

export const CREATE_TEMPLATE_WITH_SCV_MUTATION = `
  mutation CreateTemplateWithScv($input: TemplateCreateWithScvInput!) {
    createTemplateWithScv(input: $input) {
      id
      name
      entityName
    }
  }
`;
