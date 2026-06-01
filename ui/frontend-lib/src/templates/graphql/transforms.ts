import { TreeResponse } from "../../common/components/tree/types";
import { GqlUserShort, transformUserShort } from "../../users/graphql";
import {
  TemplateResponse,
  TemplateResponseOptional,
  TemplateShort,
} from "../types";

import type {
  TemplateGraphqlShortField,
  TemplateGraphqlDetailField,
  TemplateGraphqlRelationField,
} from "./fragments";

type GqlTemplateShortFieldTypes = {
  id: string;
  name: string;
  abstract: boolean;
  cloudResourceTypes: string[] | null;
};

export type GqlTemplateShort = Pick<
  GqlTemplateShortFieldTypes,
  TemplateGraphqlShortField
>;

type GqlTemplateDetailFieldTypes = {
  id: string;
  name: string;
  description: string | null;
  documentation: string | null;
  template: string;
  cloudResourceTypes: string[] | null;
  abstract: boolean;
  configuration: Record<string, any> | null;
  labels: string[] | null;
  status: string;
  revisionNumber: number;
  resourcesCount: number;
  sourceCodeVersionsCount: number;
  createdAt: string;
  updatedAt: string;
};

type GqlTemplateRelationFieldTypes = {
  creator: GqlUserShort | null;
  parents: GqlTemplateShort[] | null;
  children: GqlTemplateShort[] | null;
};

type GqlTemplateFieldTypes = GqlTemplateDetailFieldTypes &
  GqlTemplateRelationFieldTypes;

export type GqlTemplate = Pick<
  GqlTemplateFieldTypes,
  TemplateGraphqlDetailField | TemplateGraphqlRelationField
>;

export type GqlTemplateOptional = Partial<GqlTemplate> &
  Pick<GqlTemplateShortFieldTypes, "id" | "name">;

export function transformTemplateShort(gql: GqlTemplateShort): TemplateShort {
  return {
    id: gql.id,
    name: gql.name,
    abstract: gql.abstract,
    cloud_resource_types: gql.cloudResourceTypes ?? [],
    _entity_name: "template",
  };
}

export function transformTemplate(gql: GqlTemplate): TemplateResponse {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description ?? "",
    documentation: gql.documentation ?? "",
    template: gql.template,
    cloud_resource_types: gql.cloudResourceTypes ?? [],
    abstract: gql.abstract,
    configuration: {
      one_resource_per_integration:
        gql.configuration?.one_resource_per_integration ?? [],
      allowed_provider_integration_types:
        gql.configuration?.allowed_provider_integration_types ?? [],
      naming_convention: gql.configuration?.naming_convention ?? null,
      required_configuration_variables:
        gql.configuration?.required_configuration_variables ?? [],
    },
    labels: gql.labels ?? [],
    status: gql.status as TemplateResponse["status"],
    revision_number: gql.revisionNumber,
    creator: transformUserShort(gql.creator),
    parents: (gql.parents ?? []).map(transformTemplateShort),
    children: (gql.children ?? []).map(transformTemplateShort),
    created_at: gql.createdAt,
    updated_at: gql.updatedAt,
    resources_count: gql.resourcesCount,
    source_code_versions_count: gql.sourceCodeVersionsCount,
    _entity_name: "template",
  };
}

export function transformTemplateOptional(
  gql: GqlTemplateOptional,
): TemplateResponseOptional {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description ?? undefined,
    documentation: gql.documentation ?? undefined,
    template: gql.template,
    cloud_resource_types: gql.cloudResourceTypes ?? undefined,
    abstract: gql.abstract,
    configuration: gql.configuration
      ? {
          one_resource_per_integration:
            gql.configuration.one_resource_per_integration ?? [],
          allowed_provider_integration_types:
            gql.configuration.allowed_provider_integration_types ?? [],
          naming_convention: gql.configuration.naming_convention ?? null,
          required_configuration_variables:
            gql.configuration.required_configuration_variables ?? [],
        }
      : undefined,
    labels: gql.labels ?? undefined,
    status: gql.status as TemplateResponse["status"] | undefined,
    revision_number: gql.revisionNumber,
    creator:
      gql.creator !== undefined ? transformUserShort(gql.creator) : undefined,
    parents: gql.parents ? gql.parents.map(transformTemplateShort) : undefined,
    children: gql.children
      ? gql.children.map(transformTemplateShort)
      : undefined,
    created_at: gql.createdAt,
    updated_at: gql.updatedAt,
    resources_count: gql.resourcesCount,
    _entity_name: "template",
  };
}

export interface GqlTemplateTreeNode {
  id: string;
  nodeId: string;
  name: string;
  status: string;
  children: GqlTemplateTreeNode[];
}

export function transformTemplateTreeNode(
  gql: GqlTemplateTreeNode,
): TreeResponse {
  return {
    id: gql.id,
    node_id: gql.nodeId,
    name: gql.name,
    status: gql.status,
    template_name: gql.name,
    children: (gql.children ?? []).map(transformTemplateTreeNode),
  };
}
