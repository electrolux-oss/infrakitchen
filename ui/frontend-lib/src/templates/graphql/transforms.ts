import { TreeResponse } from "../../common/components/tree/types";
import { GqlUserShort, transformUserShort } from "../../users/graphql";
import { TemplateConfig, TemplateResponse, TemplateShort } from "../types";

import type {
  TemplateGraphqlShortField,
  TemplateGraphqlDetailField,
  TemplateGraphqlRelationField,
} from "./fragments";

/**
 * Backend serves `configuration` as an opaque JSON scalar with snake_case keys.
 * These helpers convert between that shape and the frontend camelCase
 * `TemplateConfig` interface.
 */

export function configFromBackend(
  raw: Record<string, any> | null | undefined,
): TemplateConfig {
  return {
    oneResourcePerIntegration: raw?.one_resource_per_integration ?? [],
    allowedProviderIntegrationTypes:
      raw?.allowed_provider_integration_types ?? [],
    namingConvention: raw?.naming_convention ?? null,
    requiredConfigurationVariables: raw?.required_configuration_variables ?? [],
  };
}

export function configToBackend(config: TemplateConfig): Record<string, any> {
  return {
    one_resource_per_integration: config.oneResourcePerIntegration,
    allowed_provider_integration_types: config.allowedProviderIntegrationTypes,
    naming_convention: config.namingConvention,
    required_configuration_variables: config.requiredConfigurationVariables,
  };
}

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

export function transformTemplateShort(gql: GqlTemplateShort): TemplateShort {
  return {
    id: gql.id,
    name: gql.name,
    abstract: gql.abstract,
    cloudResourceTypes: gql.cloudResourceTypes ?? [],
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
    cloudResourceTypes: gql.cloudResourceTypes ?? [],
    abstract: gql.abstract,
    configuration: configFromBackend(gql.configuration),
    labels: gql.labels ?? [],
    status: gql.status as TemplateResponse["status"],
    revisionNumber: gql.revisionNumber,
    creator: transformUserShort(gql.creator),
    parents: (gql.parents ?? []).map(transformTemplateShort),
    children: (gql.children ?? []).map(transformTemplateShort),
    createdAt: gql.createdAt,
    updatedAt: gql.updatedAt,
    resourcesCount: gql.resourcesCount,
    sourceCodeVersionsCount: gql.sourceCodeVersionsCount,
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
    nodeId: gql.nodeId,
    name: gql.name,
    status: gql.status,
    templateName: gql.name,
    children: (gql.children ?? []).map(transformTemplateTreeNode),
  };
}
