export type ResourceCreateFieldInput = {
  name: string;
  description: string;
  templateId: string;
  storageId: string | null;
  sourceCodeVersionId: string | null;
  integrationIds: string[];
  secretIds: string[];
  storagePath: string | null;
  variables: object[];
  outputs: object[];
  dependencyTags: object[];
  dependencyConfig: object[];
  labels: string[];
  parents: string[];
  workspaceId: string | null;
};

export const CREATE_RESOURCE_MUTATION = `
  mutation CreateResource($input: ResourceCreateInput!) {
    createResource(input: $input) {
      id
      name
      entityName
    }
  }
`;

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
      entityName
    }
  }
`;

export const CREATE_RESOURCE_POLICY_MUTATION = `
  mutation CreateResourcePolicy($input: EntityPolicyCreateInput!) {
    createResourcePolicy(input: $input) {
      id
      ptype
      v0
      v1
      v2
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
      name
      entityName
    }
  }
`;
