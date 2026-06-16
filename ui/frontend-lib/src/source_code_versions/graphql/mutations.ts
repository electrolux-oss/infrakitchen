/**
 * Partial payload for updating a single source code version field at a time,
 * used by the inline editing controls on the overview page.
 *
 * Field names are camelCase to match the backend `SourceCodeVersionUpdateInput`.
 */
export type SourceCodeVersionUpdateFieldInput = Partial<{
  description: string | null;
  labels: string[];
}>;

export const CREATE_SOURCE_CODE_VERSION_MUTATION = `
  mutation CreateSourceCodeVersion($input: SourceCodeVersionCreateInput!) {
    createSourceCodeVersion(input: $input) {
      id
      identifier
    }
  }
`;

export const UPDATE_SOURCE_CODE_VERSION_MUTATION = `
  mutation UpdateSourceCodeVersion($id: UUID!, $input: SourceCodeVersionUpdateInput!) {
    updateSourceCodeVersion(id: $id, input: $input) {
      id
      identifier
    }
  }
`;

export const SOURCE_CODE_VERSION_ACTION_MUTATION = `
  mutation SourceCodeVersionAction($id: UUID!, $input: SourceCodeVersionActionInput!) {
    sourceCodeVersionAction(id: $id, input: $input) {
      id
      identifier
    }
  }
`;

export const DELETE_SOURCE_CODE_VERSION_MUTATION = `
  mutation DeleteSourceCodeVersion($id: UUID!) {
    deleteSourceCodeVersion(id: $id)
  }
`;
