export const CREATE_WORKER_TEMPLATE_MUTATION = `
  mutation CreateWorkerTemplate($input: WorkerTemplateCreateInput!) {
    createWorkerTemplate(input: $input) {
      id
      name
      entityName
    }
  }
`;

/**
 * Partial payload for updating worker template fields, used by the inline
 * editing controls and the configuration editor.
 *
 * Field names use camelCase to match the backend `WorkerTemplateUpdateInput` GraphQL type.
 */
export type WorkerTemplateUpdateFieldInput = Partial<{
  description: string;
  labels: string[];
  configuration: Record<string, any>;
  maxWorkers: number;
  idleTimeoutSeconds: number;
  priority: number;
}>;

export const UPDATE_WORKER_TEMPLATE_MUTATION = `
  mutation UpdateWorkerTemplate($id: UUID!, $input: WorkerTemplateUpdateInput!) {
    updateWorkerTemplate(id: $id, input: $input) {
      id
      name
      entityName
    }
  }
`;

export const VALIDATE_WORKER_TEMPLATE_MUTATION = `
  mutation ValidateWorkerTemplate($id: UUID!) {
    validateWorkerTemplate(id: $id) {
      isValid
      message
    }
  }
`;
