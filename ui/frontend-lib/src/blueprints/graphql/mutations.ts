import { WORKFLOW_FIELDS } from "../../workflows/graphql";

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
      entityName
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
      entityName
    }
  }
`;

export interface BlueprintWorkflowCreateMutationInput {
  variableOverrides: Record<string, Record<string, any>>;
  workspaceId: string | null;
  integrationIds: string[];
  storageId: string | null;
  secretIds: string[];
  sourceCodeVersionOverrides: Record<string, string>;
  parentOverrides: Record<string, string[]>;
}

export const CREATE_BLUEPRINT_WORKFLOW_MUTATION = `
  mutation CreateBlueprintWorkflow($id: UUID!, $input: BlueprintWorkflowCreateInput!) {
    createBlueprintWorkflow(id: $id, input: $input) {
      ${WORKFLOW_FIELDS}
    }
  }
`;
