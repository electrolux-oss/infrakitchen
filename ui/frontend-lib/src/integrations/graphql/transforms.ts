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
    integrationProvider: integration.integrationProvider,
    _entity_name: "integration",
  };
}

export function transformIntegration(gql: GqlIntegration): IntegrationResponse {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description ?? "",
    integrationType: gql.integrationType,
    integrationProvider: gql.integrationProvider,
    configuration: gql.configuration ?? {},
    labels: gql.labels ?? [],
    status: gql.status as INTEGRATION_STATUS,
    revisionNumber: gql.revisionNumber,
    createdAt: new Date(gql.createdAt),
    updatedAt: new Date(gql.updatedAt),
    creator: transformUserShort(gql.creator)!,
    _entity_name: "integration",
    state: gql.status,
    sourceCodeCount: gql.sourceCodeCount ?? undefined,
    resourceCount: gql.resourceCount ?? undefined,
    workspaceCount: gql.workspaceCount ?? undefined,
    executorCount: gql.executorCount ?? undefined,
  };
}

export function transformIntegrationOptional(
  gql: GqlIntegrationOptional,
): IntegrationResponseOptional {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description ?? undefined,
    integrationType: gql.integrationType ?? undefined,
    integrationProvider: gql.integrationProvider,
    configuration: gql.configuration ?? undefined,
    labels: gql.labels ?? undefined,
    status: gql.status ? (gql.status as INTEGRATION_STATUS) : undefined,
    revisionNumber: gql.revisionNumber,
    createdAt: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updatedAt: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
    creator: gql.creator
      ? (transformUserShort(gql.creator) ?? undefined)
      : undefined,
    _entity_name: "integration",
    state: gql.status ?? undefined,
    sourceCodeCount: gql.sourceCodeCount ?? undefined,
    resourceCount: gql.resourceCount ?? undefined,
    workspaceCount: gql.workspaceCount ?? undefined,
    executorCount: gql.executorCount ?? undefined,
  };
}
