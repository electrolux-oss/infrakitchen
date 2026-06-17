import { ExecutorCreate, ExecutorUpdate } from "../types";

/** Input payload for the createExecutor mutation (camelCase, sent as-is). */
export type ExecutorCreateInput = ExecutorCreate;

/** Input payload for the updateExecutor mutation (camelCase, sent as-is). */
export type ExecutorUpdateInput = ExecutorUpdate;

/**
 * Partial payload describing a single executor field change, used by the inline
 * editing controls on the executor overview page.
 *
 * Only the changed field(s) are sent to the `updateExecutor` mutation as a
 * granular partial update; the backend applies just those fields and leaves the
 * rest of the executor untouched.
 */
export type ExecutorUpdateFieldInput = Partial<ExecutorUpdate>;

export const EXECUTOR_CREATE_MUTATION = `
  mutation CreateExecutor($input: ExecutorCreateInput!) {
    createExecutor(input: $input) {
      id
      name
    }
  }
`;

export const EXECUTOR_UPDATE_MUTATION = `
  mutation UpdateExecutor($id: UUID!, $input: ExecutorUpdateInput!) {
    updateExecutor(id: $id, input: $input) {
      id
      name
    }
  }
`;
