export interface BlueprintUpdateMutationInput {
  name: string;
  description: string;
  labels: string[];
}

/**
 * Partial payload for updating a single blueprint field at a time, used by the
 * inline editing controls on the blueprint overview page.
 */
export type BlueprintUpdateFieldInput = Partial<BlueprintUpdateMutationInput>;

export const UPDATE_BLUEPRINT_MUTATION = `
  mutation UpdateBlueprint($id: UUID!, $input: BlueprintUpdateInput!) {
    updateBlueprint(id: $id, input: $input) {
      id
      name
    }
  }
`;

/**
 * Payload for creating a blueprint. Keys are camelCase to match the GraphQL
 * `BlueprintCreateInput` type exposed by the backend.
 */
export interface BlueprintCreateMutationInput {
  name: string;
  description: string;
  templateIds: string[];
  externalTemplateIds: string[];
  wiring: Record<string, any>[];
  defaultVariables: Record<string, Record<string, any>>;
  configuration: Record<string, any>;
  labels: string[];
}

export const CREATE_BLUEPRINT_MUTATION = `
  mutation CreateBlueprint($input: BlueprintCreateInput!) {
    createBlueprint(input: $input) {
      id
      name
    }
  }
`;
