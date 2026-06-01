import {
  GqlIntegrationShort,
  transformIntegrationShort,
} from "../../integrations/graphql";
import { GqlUserShort, transformUserShort } from "../../users/graphql";
import {
  WorkspaceResponse,
  WorkspaceResponseOptional,
  WorkspaceShort,
} from "../types";

import type {
  WorkspaceGraphqlShortField,
  WorkspaceGraphqlDetailField,
  WorkspaceGraphqlRelationField,
} from "./fragments";

type GqlWorkspaceShortFieldTypes = {
  id: string;
  name: string;
  workspaceProvider: string;
};

type GqlWorkspaceDetailFieldTypes = {
  id: string;
  name: string;
  workspaceProvider: string;
  configuration: Record<string, any> | null;
  status: string;
  description: string;
  labels: string[] | null;
  resourcesCount: number;
  createdAt: string;
  updatedAt: string;
};

type GqlWorkspaceRelationFieldTypes = {
  integration: GqlIntegrationShort | null;
  creator: GqlUserShort | null;
};

export type GqlWorkspaceShort = Pick<
  GqlWorkspaceShortFieldTypes,
  WorkspaceGraphqlShortField
>;

type GqlWorkspaceFieldTypes = GqlWorkspaceDetailFieldTypes &
  GqlWorkspaceRelationFieldTypes;

export type GqlWorkspace = Pick<
  GqlWorkspaceFieldTypes,
  WorkspaceGraphqlDetailField | WorkspaceGraphqlRelationField
>;

export type GqlWorkspaceOptional = Partial<GqlWorkspace> &
  Pick<GqlWorkspaceShortFieldTypes, "id" | "name">;

export function transformWorkspaceShort(
  gql: GqlWorkspaceShort,
): WorkspaceShort {
  return {
    id: gql.id,
    name: gql.name,
    workspace_provider: gql.workspaceProvider,
    _entity_name: "workspace",
  };
}

export function transformWorkspace(gql: GqlWorkspace): WorkspaceResponse {
  return {
    id: gql.id,
    name: gql.name,
    _entity_name: "workspace",
    created_at: new Date(gql.createdAt),
    updated_at: new Date(gql.updatedAt),
    description: gql.description ?? "",
    labels: gql.labels ?? [],
    integration: transformIntegrationShort(gql.integration)!,
    creator: transformUserShort(gql.creator)!,
    status: gql.status,
    workspace_provider: gql.workspaceProvider,
    configuration: gql.configuration ?? {},
    resources_count: gql.resourcesCount ?? 0,
  };
}

export function transformWorkspaceOptional(
  gql: GqlWorkspaceOptional,
): WorkspaceResponseOptional {
  return {
    id: gql.id,
    name: gql.name,
    _entity_name: "workspace",
    created_at: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updated_at: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
    description: gql.description ?? undefined,
    labels: gql.labels ?? undefined,
    integration:
      gql.integration !== undefined
        ? transformIntegrationShort(gql.integration)!
        : undefined,
    creator:
      gql.creator !== undefined ? transformUserShort(gql.creator)! : undefined,
    status: gql.status,
    workspace_provider: gql.workspaceProvider,
    configuration: gql.configuration ?? undefined,
    resources_count: gql.resourcesCount,
  };
}
