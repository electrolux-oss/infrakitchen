import { WORKFLOW_FIELDS } from "./fragments";

export const WORKFLOW_QUERY = `
  query Workflow($id: UUID!) {
    workflow(id: $id) {
      ${WORKFLOW_FIELDS}
    }
  }
`;
