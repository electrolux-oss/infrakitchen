export interface WorkspaceUpdateMutationInput {
  name: string;
  description: string;
  labels: string[];
}

/**
 * Partial payload for updating a single workspace field at a time, used by the
 * inline editing controls on the workspace overview page.
 */
export type WorkspaceUpdateFieldInput = Partial<WorkspaceUpdateMutationInput>;

export const UPDATE_WORKSPACE_MUTATION = `
  mutation UpdateWorkspace($id: UUID!, $input: WorkspaceUpdateInput!) {
    updateWorkspace(id: $id, input: $input) {
      id
      name
    }
  }
`;

/**
 * Payload for creating a workspace. Keys are camelCase to match the GraphQL
 * `WorkspaceCreateInput` type exposed by the backend.
 */
export interface WorkspaceCreateMutationInput {
  description: string;
  workspaceProvider: string;
  integrationId: string;
  labels: string[];
  configuration: Record<string, any>;
}

export const CREATE_WORKSPACE_MUTATION = `
  mutation CreateWorkspace($input: WorkspaceCreateInput!) {
    createWorkspace(input: $input) {
      id
      name
    }
  }
`;

export const DELETE_WORKSPACE_MUTATION = `
  mutation DeleteWorkspace($id: UUID!) {
    deleteWorkspace(id: $id)
  }
`;
