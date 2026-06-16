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
    secretProvider: gql.secretProvider,
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
    createdAt: new Date(gql.createdAt),
    updatedAt: new Date(gql.updatedAt),
    status: gql.status,
    state: gql.state,
    description: gql.description ?? "",
    revisionNumber: gql.revisionNumber,
    labels: gql.labels ?? [],
    integration: transformIntegrationShort(gql.integration),
    creator: transformUserShort(gql.creator)!,
    secretType: gql.secretType,
    secretProvider: gql.secretProvider,
    configuration:
      (gql.configuration as SecretResponse["configuration"] | null) ??
      defaultConfiguration(gql.secretProvider),
    resourcesCount: gql.resourcesCount ?? 0,
    executorsCount: gql.executorsCount ?? 0,
  };
}

export function transformSecretOptional(
  gql: GqlSecretOptional,
): SecretResponseOptional {
  return {
    id: gql.id,
    name: gql.name,
    _entity_name: "secret",
    createdAt: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updatedAt: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
    status: gql.status,
    state: gql.state,
    description: gql.description ?? undefined,
    revisionNumber: gql.revisionNumber,
    labels: gql.labels ?? undefined,
    integration:
      gql.integration !== undefined
        ? transformIntegrationShort(gql.integration)
        : undefined,
    creator:
      gql.creator !== undefined ? transformUserShort(gql.creator)! : undefined,
    secretType: gql.secretType,
    secretProvider: gql.secretProvider,
    resourcesCount: gql.resourcesCount,
    executorsCount: gql.executorsCount,
    configuration: gql.configuration
      ? (gql.configuration as SecretResponse["configuration"])
      : gql.secretProvider
        ? defaultConfiguration(gql.secretProvider)
        : undefined,
  };
}
