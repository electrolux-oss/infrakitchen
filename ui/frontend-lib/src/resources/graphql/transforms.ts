import {
  GqlIntegrationShort,
  transformIntegrationShort,
} from "../../integrations/graphql";
import { IntegrationShort } from "../../integrations/types";
import { GqlSecret, transformSecret } from "../../secrets/graphql";
import {
  GqlSourceCodeVersionShort,
  transformSourceCodeVersionShort,
} from "../../source_code_versions/graphql";
import { GqlStorage, transformStorage } from "../../storages/graphql";
import {
  GqlTemplateShort,
  transformTemplateShort,
} from "../../templates/graphql";
import { GqlUserShort, transformUserShort } from "../../users/graphql";
import {
  GqlWorkspaceShort,
  transformWorkspaceShort,
} from "../../workspaces/graphql";
import {
  ResourceResponse,
  ResourceResponseOptional,
  ResourceShort,
  VariableInput,
  VariableOutput,
  DependencyVariable,
} from "../types";

import type {
  ResourceGraphqlShortField,
  ResourceGraphqlDetailField,
  ResourceGraphqlRelationField,
} from "./fragments";

type GqlResourceShortFieldTypes = {
  id: string;
  name: string;
  state: string;
  status: string;
  isFavorite: boolean;
};

export type GqlResourceShort = Pick<
  GqlResourceShortFieldTypes,
  ResourceGraphqlShortField
> & {
  template: GqlTemplateShort;
};

type GqlResourceDetailFieldTypes = {
  id: string;
  name: string;
  description: string;
  abstract: boolean;
  revisionNumber: number;
  storagePath: string | null;
  variables: Array<Record<string, any>> | null;
  outputs: Array<Record<string, any>> | null;
  dependencyTags: Array<Record<string, any>> | null;
  dependencyConfig: Array<Record<string, any>> | null;
  state: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  labels: string[] | null;
  isFavorite: boolean;
};

type GqlResourceRelationFieldTypes = {
  template: GqlTemplateShort | null;
  sourceCodeVersion: GqlSourceCodeVersionShort | null;
  integrationIds: GqlIntegrationShort[] | null;
  secretIds: GqlSecret[] | null;
  storage: GqlStorage | null;
  creator: GqlUserShort | null;
  parents: GqlResourceShort[] | null;
  children: GqlResourceShort[] | null;
  workspace: GqlWorkspaceShort | null;
};

type GqlResourceFieldTypes = GqlResourceDetailFieldTypes &
  GqlResourceRelationFieldTypes;

export type GqlResource = Pick<
  GqlResourceFieldTypes,
  ResourceGraphqlDetailField | ResourceGraphqlRelationField
>;

export type GqlResourceOptional = Partial<GqlResource> &
  Pick<GqlResourceShortFieldTypes, "id" | "name">;

export interface GqlResourceTempState {
  resourceId: string;
  value: Record<string, any>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function mapResourceRelation(relation: GqlResourceShort): ResourceShort {
  return {
    id: relation.id,
    name: relation.name,
    template: transformTemplateShort(relation.template),
    state: relation.state,
    status: relation.status,
    isFavorite: relation.isFavorite,
    _entity_name: "resource",
  };
}

function mapVariables(
  items: Array<Record<string, any>> | null,
): VariableInput[] {
  return (items ?? []) as VariableInput[];
}

function mapOutputs(
  items: Array<Record<string, any>> | null,
): VariableOutput[] {
  return (items ?? []) as VariableOutput[];
}

function mapDependency(
  items: Array<Record<string, any>> | null,
): DependencyVariable[] {
  return (items ?? []) as DependencyVariable[];
}

export function transformResource(gql: GqlResource): ResourceResponse {
  const integrationIds = gql.integrationIds
    ? gql.integrationIds
        .map(transformIntegrationShort)
        .filter((int): int is IntegrationShort => int !== null)
    : [];

  return {
    id: gql.id,
    name: gql.name,
    created_at: new Date(gql.createdAt),
    updated_at: new Date(gql.updatedAt),
    state: gql.state,
    status: gql.status,
    description: gql.description ?? "",
    abstract: gql.abstract,
    revision_number: gql.revisionNumber,
    creator: gql.creator ? transformUserShort(gql.creator) : null,
    template: transformTemplateShort(gql.template!),
    integration_ids: integrationIds,
    secret_ids: (gql.secretIds ?? []).map(transformSecret),
    storage: gql.storage ? transformStorage(gql.storage) : null,
    source_code_version: gql.sourceCodeVersion
      ? transformSourceCodeVersionShort(gql.sourceCodeVersion)
      : null,
    storage_path: gql.storagePath ?? null,
    variables: mapVariables(gql.variables),
    outputs: mapOutputs(gql.outputs),
    dependency_tags: mapDependency(gql.dependencyTags),
    dependency_config: mapDependency(gql.dependencyConfig),
    parents: (gql.parents ?? []).map(mapResourceRelation),
    children: (gql.children ?? []).map(mapResourceRelation),
    labels: gql.labels ?? [],
    workspace: gql.workspace ? transformWorkspaceShort(gql.workspace) : null,
    isFavorite: gql.isFavorite,
    _entity_name: "resource",
  };
}

export function transformResourceShort(gql: GqlResourceShort): ResourceShort {
  return {
    id: gql.id,
    name: gql.name,
    template: transformTemplateShort(gql.template),
    state: gql.state,
    status: gql.status,
    isFavorite: gql.isFavorite,
    _entity_name: "resource",
  };
}

export function transformResourceOptional(
  gql: GqlResourceOptional,
): ResourceResponseOptional {
  const integrationIds = gql.integrationIds
    ? gql.integrationIds
        .map(transformIntegrationShort)
        .filter((int): int is IntegrationShort => int !== null)
    : undefined;

  return {
    id: gql.id,
    name: gql.name,
    created_at: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updated_at: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
    state: gql.state,
    status: gql.status,
    description: gql.description ?? undefined,
    abstract: gql.abstract,
    revision_number: gql.revisionNumber,
    creator:
      gql.creator !== undefined ? transformUserShort(gql.creator) : undefined,
    template: gql.template ? transformTemplateShort(gql.template) : undefined,
    integration_ids: integrationIds,
    secret_ids: gql.secretIds ? gql.secretIds.map(transformSecret) : undefined,
    storage: gql.storage ? transformStorage(gql.storage) : undefined,
    source_code_version: gql.sourceCodeVersion
      ? transformSourceCodeVersionShort(gql.sourceCodeVersion)
      : undefined,
    storage_path: gql.storagePath ?? undefined,
    variables: gql.variables ? mapVariables(gql.variables) : undefined,
    outputs: gql.outputs ? mapOutputs(gql.outputs) : undefined,
    dependency_tags: gql.dependencyTags
      ? mapDependency(gql.dependencyTags)
      : undefined,
    dependency_config: gql.dependencyConfig
      ? mapDependency(gql.dependencyConfig)
      : undefined,
    parents: gql.parents ? gql.parents.map(mapResourceRelation) : undefined,
    children: gql.children ? gql.children.map(mapResourceRelation) : undefined,
    labels: gql.labels ?? undefined,
    workspace: gql.workspace
      ? transformWorkspaceShort(gql.workspace)
      : undefined,
    isFavorite: gql.isFavorite,
    _entity_name: "resource",
  };
}

export function transformResourceTempState(gql: GqlResourceTempState): {
  resource_id: string;
  value: Record<string, any>;
  created_by: string;
  created_at: Date;
  updated_at: Date;
} {
  return {
    resource_id: gql.resourceId,
    value: gql.value,
    created_by: gql.createdBy,
    created_at: new Date(gql.createdAt),
    updated_at: new Date(gql.updatedAt),
  };
}
