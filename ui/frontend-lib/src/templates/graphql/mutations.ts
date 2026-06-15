import {
  TemplateConfig,
  TemplateCreateRequest,
  TemplateUpdate,
} from "../types";

export interface TemplateCreateMutationInput {
  name: string;
  description: string;
  documentation: string;
  template: string;
  parents: string[];
  children: string[];
  cloudResourceTypes: string[];
  configuration: TemplateConfig;
  labels: string[];
  abstract: boolean;
}

export interface TemplateUpdateMutationInput {
  name: string;
  description: string;
  documentation: string;
  parents: string[];
  children: string[];
  cloudResourceTypes: string[];
  configuration: TemplateConfig;
  labels: string[];
}

/**
 * Partial payload for updating a single template field at a time, used by the
 * inline editing controls on the template overview page.
 */
export type TemplateUpdateFieldInput = Partial<TemplateUpdateMutationInput>;

export function toTemplateCreateMutationInput(
  payload: TemplateCreateRequest,
): TemplateCreateMutationInput {
  return {
    name: payload.name,
    description: payload.description,
    documentation: payload.documentation,
    template: payload.template,
    parents: payload.parents,
    children: payload.children,
    cloudResourceTypes: payload.cloud_resource_types,
    configuration: payload.configuration,
    labels: payload.labels,
    abstract: payload.abstract,
  };
}

export function toTemplateUpdateMutationInput(
  payload: TemplateUpdate,
): TemplateUpdateMutationInput {
  return {
    name: payload.name,
    description: payload.description,
    documentation: payload.documentation,
    parents: payload.parents,
    children: payload.children,
    cloudResourceTypes: payload.cloud_resource_types,
    configuration: payload.configuration,
    labels: payload.labels,
  };
}

export const CREATE_TEMPLATE_MUTATION = `
  mutation CreateTemplate($input: TemplateCreateInput!) {
    createTemplate(input: $input) {
      id
      name
      template
    }
  }
`;

export const UPDATE_TEMPLATE_MUTATION = `
  mutation UpdateTemplate($id: UUID!, $input: TemplateUpdateInput!) {
    updateTemplate(id: $id, input: $input) {
      id
      name
      template
    }
  }
`;
