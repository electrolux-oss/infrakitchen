export interface TemplateUpdateMutationInput {
  name: string;
  description: string;
  documentation: string;
  parents: string[];
  children: string[];
  cloudResourceTypes: string[];
  configuration: Record<string, any>;
  labels: string[];
}

/**
 * Partial payload for updating a single template field at a time, used by the
 * inline editing controls on the template overview page.
 */
export type TemplateUpdateFieldInput = Partial<TemplateUpdateMutationInput>;

export const CREATE_TEMPLATE_MUTATION = `
  mutation CreateTemplate($input: TemplateCreateInput!) {
    createTemplate(input: $input) {
      id
      name
      template
    }
  }
`;

export const UPDATE_TEMPLATE_MUTATION = `
  mutation UpdateTemplate($id: UUID!, $input: TemplateUpdateInput!) {
    updateTemplate(id: $id, input: $input) {
      id
      name
      template
    }
  }
`;
