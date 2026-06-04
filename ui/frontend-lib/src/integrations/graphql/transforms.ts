import { GqlUserShort, transformUserShort } from "../../users/graphql";
import { INTEGRATION_STATUS } from "../../utils/constants";
import {
  IntegrationResponse,
  IntegrationResponseOptional,
  IntegrationShort,
} from "../types";

import type {
  IntegrationGraphqlBaseField,
  IntegrationGraphqlDetailsField,
  IntegrationGraphqlRelationField,
  IntegrationGraphqlShortField,
} from "./fragments";

type GqlIntegrationShortFieldTypes = {
  id: string;
  name: string;
  integrationProvider: string;
};

export type GqlIntegrationShort = Pick<
  GqlIntegrationShortFieldTypes,
  IntegrationGraphqlShortField
>;

type GqlIntegrationBaseFieldTypes = {
  id: string;
  name: string;
  description: string | null;
  integrationType: string;
  integrationProvider: string;
  configuration: Record<string, any> | null;
  labels: string[] | null;
  status: string;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
};

type GqlIntegrationRelationFieldTypes = {
  creator: GqlUserShort | null;
};

type GqlIntegrationDetailsFieldTypes = {
  resourceCount: number | null;
  sourceCodeCount: number | null;
  workspaceCount: number | null;
  executorCount: number | null;
};

type GqlIntegrationFieldTypes = GqlIntegrationBaseFieldTypes &
  GqlIntegrationRelationFieldTypes &
  GqlIntegrationDetailsFieldTypes;

export type GqlIntegration = Pick<
  GqlIntegrationFieldTypes,
  | IntegrationGraphqlBaseField
  | IntegrationGraphqlRelationField
  | IntegrationGraphqlDetailsField
>;

export type GqlIntegrationOptional = Partial<GqlIntegration> &
  Pick<GqlIntegrationShortFieldTypes, "id" | "name" | "integrationProvider">;

export function transformIntegrationShort(
  integration: GqlIntegrationShort | null,
): IntegrationShort | null {
  if (!integration) {
    return null;
  }
  return {
    id: integration.id,
    name: integration.name,
    integration_provider: integration.integrationProvider,
    _entity_name: "integration",
  };
}

export function transformIntegration(gql: GqlIntegration): IntegrationResponse {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description ?? "",
    integration_type: gql.integrationType,
    integration_provider: gql.integrationProvider,
    configuration: gql.configuration ?? {},
    labels: gql.labels ?? [],
    status: gql.status as INTEGRATION_STATUS,
    revision_number: gql.revisionNumber,
    created_at: new Date(gql.createdAt),
    updated_at: new Date(gql.updatedAt),
    creator: transformUserShort(gql.creator)!,
    _entity_name: "integration",
    state: gql.status,
    source_code_count: gql.sourceCodeCount ?? undefined,
    resource_count: gql.resourceCount ?? undefined,
    workspace_count: gql.workspaceCount ?? undefined,
    executor_count: gql.executorCount ?? undefined,
  };
}

export function transformIntegrationOptional(
  gql: GqlIntegrationOptional,
): IntegrationResponseOptional {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description ?? undefined,
    integration_type: gql.integrationType ?? undefined,
    integration_provider: gql.integrationProvider,
    configuration: gql.configuration ?? undefined,
    labels: gql.labels ?? undefined,
    status: gql.status ? (gql.status as INTEGRATION_STATUS) : undefined,
    revision_number: gql.revisionNumber,
    created_at: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updated_at: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
    creator: gql.creator
      ? (transformUserShort(gql.creator) ?? undefined)
      : undefined,
    _entity_name: "integration",
    state: gql.status ?? undefined,
    source_code_count: gql.sourceCodeCount ?? undefined,
    resource_count: gql.resourceCount ?? undefined,
    workspace_count: gql.workspaceCount ?? undefined,
    executor_count: gql.executorCount ?? undefined,
  };
}
