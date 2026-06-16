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

export const UPDATE_SOURCE_CODE_VERSION_MUTATION = `
  mutation UpdateSourceCodeVersion($id: UUID!, $input: SourceCodeVersionUpdateInput!) {
    updateSourceCodeVersion(id: $id, input: $input) {
      id
      identifier
    }
  }
`;
