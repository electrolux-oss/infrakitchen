export const CREATE_STORAGE_MUTATION = `
  mutation CreateStorage($input: StorageCreateInput!) {
    createStorage(input: $input) {
      id
      name
      entityName
    }
  }
`;

/**
 * Partial payload for updating a single storage field at a time, used by the
 * inline editing controls on the storage overview page.
 */
export type StorageUpdateFieldInput = Partial<{
  description: string;
  labels: string[];
}>;

export const UPDATE_STORAGE_MUTATION = `
  mutation UpdateStorage($id: UUID!, $input: StorageUpdateInput!) {
    updateStorage(id: $id, input: $input) {
      id
      name
      entityName
    }
  }
`;
