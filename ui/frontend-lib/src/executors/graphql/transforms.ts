import {
  GqlIntegrationShort,
  transformIntegrationShort,
} from "../../integrations/graphql";
import { GqlSecretShort, transformSecretShort } from "../../secrets/graphql";
import {
  GqlSourceCodeShort,
  transformSourceCodeShort,
} from "../../source_codes/graphql";
import { GqlStorageShort, transformStorageShort } from "../../storages/graphql";
import { GqlUserShort, transformUserShort } from "../../users/graphql";
import { ExecutorResponse, ExecutorResponseOptional } from "../types";

export interface GqlExecutor {
  id: string;
  name: string;
  description: string;
  runtime: string;
  commandArgs: string;
  sourceCode: GqlSourceCodeShort | null;
  sourceCodeVersion: string | null;
  sourceCodeBranch: string | null;
  sourceCodeFolder: string | null;
  integrationIds: GqlIntegrationShort[] | null;
  secretIds: GqlSecretShort[] | null;
  storage: GqlStorageShort | null;
  storagePath: string | null;
  labels: string[] | null;
  state: string;
  status: string;
  revisionNumber: number;
  creator: GqlUserShort | null;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
}

export type GqlExecutorOptional = Partial<GqlExecutor> & {
  id: string;
  name: string;
};

export function transformExecutor(gql: GqlExecutor): ExecutorResponse {
  return {
    id: gql.id,
    name: gql.name,
    createdAt: new Date(gql.createdAt),
    updatedAt: new Date(gql.updatedAt),
    state: gql.state,
    status: gql.status,
    description: gql.description ?? "",
    commandArgs: gql.commandArgs ?? "",
    runtime: gql.runtime ?? "",
    revisionNumber: gql.revisionNumber,
    creator: transformUserShort(gql.creator),
    integrationIds: (gql.integrationIds ?? []).map(
      transformIntegrationShort,
    ) as ExecutorResponse["integrationIds"],
    secretIds: (gql.secretIds ?? []).map(transformSecretShort),
    storage: gql.storage ? transformStorageShort(gql.storage) : null,
    sourceCode: gql.sourceCode
      ? transformSourceCodeShort(gql.sourceCode)
      : null,
    sourceCodeBranch: gql.sourceCodeBranch,
    sourceCodeVersion: gql.sourceCodeVersion,
    sourceCodeFolder: gql.sourceCodeFolder ?? "",
    storagePath: gql.storagePath,
    labels: gql.labels ?? [],
    isFavorite: gql.isFavorite,
    _entity_name: "executor",
  };
}

export function transformExecutorOptional(
  gql: GqlExecutorOptional,
): ExecutorResponseOptional {
  return {
    id: gql.id,
    name: gql.name,
    createdAt: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updatedAt: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
    state: gql.state,
    status: gql.status,
    description: gql.description ?? undefined,
    commandArgs: gql.commandArgs ?? undefined,
    runtime: gql.runtime ?? undefined,
    revisionNumber: gql.revisionNumber,
    creator:
      gql.creator !== undefined ? transformUserShort(gql.creator) : undefined,
    integrationIds: gql.integrationIds
      ? (gql.integrationIds.map(
          transformIntegrationShort,
        ) as ExecutorResponse["integrationIds"])
      : undefined,
    secretIds: gql.secretIds
      ? gql.secretIds.map(transformSecretShort)
      : undefined,
    storage:
      gql.storage !== undefined
        ? gql.storage
          ? transformStorageShort(gql.storage)
          : null
        : undefined,
    sourceCode:
      gql.sourceCode !== undefined
        ? gql.sourceCode
          ? transformSourceCodeShort(gql.sourceCode)
          : null
        : undefined,
    sourceCodeBranch: gql.sourceCodeBranch,
    sourceCodeVersion: gql.sourceCodeVersion,
    sourceCodeFolder: gql.sourceCodeFolder ?? undefined,
    storagePath: gql.storagePath,
    labels: gql.labels ?? undefined,
    isFavorite: gql.isFavorite,
    _entity_name: "executor",
  };
}
