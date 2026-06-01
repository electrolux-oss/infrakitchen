import {
  GqlIntegrationShort,
  transformIntegrationShort,
} from "../../integrations/graphql";
import { GqlUserShort, transformUserShort } from "../../users/graphql";
import { SecretResponse, SecretResponseOptional, SecretShort } from "../types";

import type {
  SecretGraphqlShortField,
  SecretGraphqlBaseField,
  SecretGraphqlRelationField,
} from "./fragments";

type GqlSecretShortFieldTypes = {
  id: string;
  name: string;
  secretType: string;
  secretProvider: string;
};

export type GqlSecretShort = Pick<
  GqlSecretShortFieldTypes,
  SecretGraphqlShortField
>;

type GqlSecretBaseFieldTypes = {
  id: string;
  name: string;
  secretType: string;
  secretProvider: string;
  configuration: Record<string, any> | null;
  description: string;
  labels: string[] | null;
  state: string;
  status: string;
  revisionNumber: number;
  resourcesCount: number;
  executorsCount: number;
  createdAt: string;
  updatedAt: string;
};

type GqlSecretRelationFieldTypes = {
  integration: GqlIntegrationShort | null;
  creator: GqlUserShort | null;
};

type GqlSecretFieldTypes = GqlSecretBaseFieldTypes &
  GqlSecretRelationFieldTypes;

export type GqlSecret = Pick<
  GqlSecretFieldTypes,
  SecretGraphqlBaseField | SecretGraphqlRelationField
>;

export type GqlSecretOptional = Partial<GqlSecret> &
  Pick<GqlSecretShortFieldTypes, "id" | "name">;

export function transformSecretShort(gql: GqlSecretShort): SecretShort {
  return {
    id: gql.id,
    name: gql.name,
    secret_provider: gql.secretProvider,
    _entity_name: "secret",
  };
}

function defaultConfiguration(secretProvider: string) {
  return {
    secret_provider: secretProvider,
    secrets: [],
  };
}

export function transformSecret(gql: GqlSecret): SecretResponse {
  return {
    id: gql.id,
    name: gql.name,
    _entity_name: "secret",
    created_at: new Date(gql.createdAt),
    updated_at: new Date(gql.updatedAt),
    status: gql.status,
    state: gql.state,
    description: gql.description ?? "",
    revision_number: gql.revisionNumber,
    labels: gql.labels ?? [],
    integration: transformIntegrationShort(gql.integration),
    creator: transformUserShort(gql.creator)!,
    secret_type: gql.secretType,
    secret_provider: gql.secretProvider,
    configuration:
      (gql.configuration as SecretResponse["configuration"] | null) ??
      defaultConfiguration(gql.secretProvider),
    resources_count: gql.resourcesCount ?? 0,
    executors_count: gql.executorsCount ?? 0,
  };
}

export function transformSecretOptional(
  gql: GqlSecretOptional,
): SecretResponseOptional {
  return {
    id: gql.id,
    name: gql.name,
    _entity_name: "secret",
    created_at: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updated_at: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
    status: gql.status,
    state: gql.state,
    description: gql.description ?? undefined,
    revision_number: gql.revisionNumber,
    labels: gql.labels ?? undefined,
    integration:
      gql.integration !== undefined
        ? transformIntegrationShort(gql.integration)
        : undefined,
    creator:
      gql.creator !== undefined ? transformUserShort(gql.creator)! : undefined,
    secret_type: gql.secretType,
    secret_provider: gql.secretProvider,
    resources_count: gql.resourcesCount,
    executors_count: gql.executorsCount,
    configuration: gql.configuration
      ? (gql.configuration as SecretResponse["configuration"])
      : gql.secretProvider
        ? defaultConfiguration(gql.secretProvider)
        : undefined,
  };
}
