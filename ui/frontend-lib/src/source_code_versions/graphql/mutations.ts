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

export type SourceConfigUpdateItemInput = Partial<{
  id: string;
  required: boolean;
  default: any;
  frozen: boolean;
  unique: boolean;
  restricted: boolean;
  options: string[];
  templateId: string;
  referenceTemplateId: string | null;
  outputConfigName: string | null;
}>;

export const CREATE_SOURCE_CODE_VERSION_MUTATION = `
  mutation CreateSourceCodeVersion($input: SourceCodeVersionCreateInput!) {
    createSourceCodeVersion(input: $input) {
      id
      identifier
      entityName
    }
  }
`;

export const UPDATE_SOURCE_CODE_VERSION_MUTATION = `
  mutation UpdateSourceCodeVersion($id: UUID!, $input: SourceCodeVersionUpdateInput!) {
    updateSourceCodeVersion(id: $id, input: $input) {
      id
      identifier
      entityName
    }
  }
`;

export const SOURCE_CODE_VERSION_ACTION_MUTATION = `
  mutation SourceCodeVersionAction($id: UUID!, $input: SourceCodeVersionActionInput!) {
    sourceCodeVersionAction(id: $id, input: $input) {
      id
      identifier
      entityName
    }
  }
`;

export const DELETE_SOURCE_CODE_VERSION_MUTATION = `
  mutation DeleteSourceCodeVersion($id: UUID!) {
    deleteSourceCodeVersion(id: $id)
  }
`;

export const UPDATE_SOURCE_CODE_VERSION_CONFIGS_MUTATION = `
  mutation UpdateSourceCodeVersionConfigs(
    $id: UUID!
    $configs: [SourceConfigUpdateItemInput!]!
  ) {
    updateSourceCodeVersionConfigs(id: $id, configs: $configs) {
      id
      name
    }
  }
`;
