import { WORKFLOW_FIELDS } from "./fragments";

export const UPDATE_WORKFLOW_MUTATION = `
  mutation UpdateWorkflow($id: UUID!, $input: WorkflowUpdateInput!) {
    updateWorkflow(id: $id, input: $input) {
      ${WORKFLOW_FIELDS}
    }
  }
`;
