import { WORKER_TEMPLATE_FIELDS } from "./fragments";
import type { WorkerConfiguration } from "./transforms";

/**
 * Partial payload for updating worker template fields, used by the inline
 * editors on the worker template page. The provider and name cannot change.
 */
export type WorkerTemplateUpdateFieldInput = Partial<{
  description: string;
  labels: string[];
  configuration: WorkerConfiguration;
  maxWorkers: number;
  idleTimeoutSeconds: number;
}>;

export const CREATE_WORKER_TEMPLATE_MUTATION = `
  mutation CreateWorkerTemplate($input: WorkerTemplateCreateInput!) {
    createWorkerTemplate(input: $input) {
      id
      name
      entityName
    }
  }
`;

export const UPDATE_WORKER_TEMPLATE_MUTATION = `
  mutation UpdateWorkerTemplate($id: UUID!, $input: WorkerTemplateUpdateInput!) {
    updateWorkerTemplate(id: $id, input: $input) {
      ${WORKER_TEMPLATE_FIELDS}
    }
  }
`;

export const SET_DEFAULT_WORKER_TEMPLATE_MUTATION = `
  mutation SetDefaultWorkerTemplate($id: UUID) {
    setDefaultWorkerTemplate(id: $id) {
      id
      isDefault
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

export const VALIDATE_WORKER_TEMPLATE_DRAFT_MUTATION = `
  mutation ValidateWorkerTemplateDraft($input: WorkerTemplateCreateInput!) {
    validateWorkerTemplateDraft(input: $input) {
      isValid
      message
    }
  }
`;
