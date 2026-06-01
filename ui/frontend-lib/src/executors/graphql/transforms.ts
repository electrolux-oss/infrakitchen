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
}

export type GqlExecutorOptional = Partial<GqlExecutor> & {
  id: string;
  name: string;
};

export function transformExecutor(gql: GqlExecutor): ExecutorResponse {
  return {
    id: gql.id,
    name: gql.name,
    created_at: new Date(gql.createdAt),
    updated_at: new Date(gql.updatedAt),
    state: gql.state,
    status: gql.status,
    description: gql.description ?? "",
    command_args: gql.commandArgs ?? "",
    runtime: gql.runtime ?? "",
    revision_number: gql.revisionNumber,
    creator: transformUserShort(gql.creator),
    integration_ids: (gql.integrationIds ?? []).map(
      transformIntegrationShort,
    ) as ExecutorResponse["integration_ids"],
    secret_ids: (gql.secretIds ?? []).map(transformSecretShort),
    storage: gql.storage ? transformStorageShort(gql.storage) : null,
    source_code: gql.sourceCode
      ? transformSourceCodeShort(gql.sourceCode)
      : null,
    source_code_branch: gql.sourceCodeBranch,
    source_code_version: gql.sourceCodeVersion,
    source_code_folder: gql.sourceCodeFolder ?? "",
    storage_path: gql.storagePath,
    labels: gql.labels ?? [],
    _entity_name: "executor",
  };
}

export function transformExecutorOptional(
  gql: GqlExecutorOptional,
): ExecutorResponseOptional {
  return {
    id: gql.id,
    name: gql.name,
    created_at: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updated_at: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
    state: gql.state,
    status: gql.status,
    description: gql.description ?? undefined,
    command_args: gql.commandArgs ?? undefined,
    runtime: gql.runtime ?? undefined,
    revision_number: gql.revisionNumber,
    creator:
      gql.creator !== undefined ? transformUserShort(gql.creator) : undefined,
    integration_ids: gql.integrationIds
      ? (gql.integrationIds.map(
          transformIntegrationShort,
        ) as ExecutorResponse["integration_ids"])
      : undefined,
    secret_ids: gql.secretIds
      ? gql.secretIds.map(transformSecretShort)
      : undefined,
    storage:
      gql.storage !== undefined
        ? gql.storage
          ? transformStorageShort(gql.storage)
          : null
        : undefined,
    source_code:
      gql.sourceCode !== undefined
        ? gql.sourceCode
          ? transformSourceCodeShort(gql.sourceCode)
          : null
        : undefined,
    source_code_branch: gql.sourceCodeBranch,
    source_code_version: gql.sourceCodeVersion,
    source_code_folder: gql.sourceCodeFolder ?? undefined,
    storage_path: gql.storagePath,
    labels: gql.labels ?? undefined,
    _entity_name: "executor",
  };
}
