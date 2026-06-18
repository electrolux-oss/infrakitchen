/**
 * Partial payload for updating a single resource field at a time, used by the
 * inline editing controls on the resource overview page.
 *
 * Field names are camelCase and match the backend `ResourceUpdateInput`
 * (see server/src/graphql_api/modules/resource/mutations.py).
 */
export type ResourceUpdateFieldInput = Partial<{
  name: string;
  description: string;
  sourceCodeVersionId: string | null;
  integrationIds: string[];
  secretIds: string[];
  storageId: string | null;
  storagePath: string | null;
  variables: object[];
  dependencyTags: object[];
  dependencyConfig: object[];
  labels: string[];
  workspaceId: string | null;
}>;

export const UPDATE_RESOURCE_MUTATION = `
  mutation UpdateResource($id: UUID!, $input: ResourceUpdateInput!) {
    updateResource(id: $id, input: $input) {
      id
      name
    }
  }
`;

export const CASCADE_DESTROY_RESOURCE_MUTATION = `
  mutation CascadeDestroyResource($id: UUID!) {
    cascadeDestroyResource(id: $id) {
      id
    }
  }
`;

export const SYNC_WORKSPACE_MUTATION = `
  mutation SyncWorkspace($id: UUID!) {
    syncWorkspace(id: $id) {
      id
    }
  }
`;
