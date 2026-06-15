/**
 * Partial payload for updating a single source code field at a time, used by
 * the inline editing controls on the source code overview page.
 *
 * Field names are camelCase to match the backend `SourceCodeUpdateInput`.
 */
export type SourceCodeUpdateFieldInput = Partial<{
  description: string | null;
  integrationId: string | null;
  labels: string[];
}>;

export const UPDATE_SOURCE_CODE_MUTATION = `
  mutation UpdateSourceCode($id: UUID!, $input: SourceCodeUpdateInput!) {
    updateSourceCode(id: $id, input: $input) {
      id
      identifier
      sourceCodeUrl
    }
  }
`;
