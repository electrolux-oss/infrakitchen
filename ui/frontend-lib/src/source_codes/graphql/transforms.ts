import {
  GqlIntegrationShort,
  transformIntegrationShort,
} from "../../integrations/graphql";
import { GqlUserShort, transformUserShort } from "../../users/graphql";
import {
  SourceCodeResponse,
  SourceCodeResponseOptional,
  SourceCodeShort,
} from "../types";

import type {
  SourceCodeGraphqlShortField,
  SourceCodeGraphqlDetailField,
  SourceCodeGraphqlRelationField,
} from "./fragments";

interface GqlRefFolders {
  ref: string;
  folders: string[];
}

type GqlSourceCodeShortFieldTypes = {
  id: string;
  identifier: string;
  sourceCodeUrl: string;
  sourceCodeProvider: string;
  sourceCodeLanguage: string;
  status: string;
};

export type GqlSourceCodeShort = Pick<
  GqlSourceCodeShortFieldTypes,
  SourceCodeGraphqlShortField
>;

type GqlSourceCodeDetailFieldTypes = {
  id: string;
  identifier: string;
  description: string | null;
  sourceCodeUrl: string;
  sourceCodeProvider: string;
  sourceCodeLanguage: string;
  integrationId: string | null;
  gitTags: string[] | null;
  gitTagMessages: Record<string, string> | null;
  gitBranches: string[] | null;
  gitBranchMessages: Record<string, string> | null;
  gitFoldersMap: GqlRefFolders[] | null;
  labels: string[] | null;
  status: string;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
};

type GqlSourceCodeRelationFieldTypes = {
  integration: GqlIntegrationShort | null;
  creator: GqlUserShort | null;
};

type GqlSourceCodeFieldTypes = GqlSourceCodeDetailFieldTypes &
  GqlSourceCodeRelationFieldTypes;

export type GqlSourceCode = Pick<
  GqlSourceCodeFieldTypes,
  SourceCodeGraphqlDetailField | SourceCodeGraphqlRelationField
>;

export type GqlSourceCodeOptional = Partial<GqlSourceCode> &
  Pick<GqlSourceCodeShortFieldTypes, "id" | "sourceCodeUrl">;

export function transformSourceCode(gql: GqlSourceCode): SourceCodeResponse {
  return {
    id: gql.id,
    identifier: gql.identifier,
    source_code_url: gql.sourceCodeUrl,
    source_code_provider: gql.sourceCodeProvider,
    source_code_language: gql.sourceCodeLanguage,
    _entity_name: "source_code",
    created_at: gql.createdAt,
    updated_at: gql.updatedAt,
    status: gql.status,
    revision_number: gql.revisionNumber,
    labels: gql.labels ?? [],
    integration: transformIntegrationShort(gql.integration)!,
    creator: transformUserShort(gql.creator)!,
    git_tags: gql.gitTags ?? [],
    git_tag_messages: gql.gitTagMessages ?? {},
    git_branches: gql.gitBranches ?? [],
    git_branch_messages: gql.gitBranchMessages ?? {},
    git_folders_map: gql.gitFoldersMap ?? [],
    description: gql.description ?? "",
  };
}

export function transformSourceCodeShort(
  gql: GqlSourceCodeShort,
): SourceCodeShort {
  return {
    id: gql.id,
    identifier: gql.identifier,
    source_code_url: gql.sourceCodeUrl,
    source_code_provider: gql.sourceCodeProvider,
    source_code_language: gql.sourceCodeLanguage,
    _entity_name: "source_code",
  };
}

export function transformSourceCodeOptional(
  gql: GqlSourceCodeOptional,
): SourceCodeResponseOptional {
  return {
    id: gql.id,
    identifier: gql.identifier,
    source_code_url: gql.sourceCodeUrl,
    source_code_provider: gql.sourceCodeProvider,
    source_code_language: gql.sourceCodeLanguage,
    _entity_name: "source_code",
    created_at: gql.createdAt,
    updated_at: gql.updatedAt,
    status: gql.status,
    revision_number: gql.revisionNumber,
    labels: gql.labels ?? undefined,
    integration:
      gql.integration !== undefined
        ? transformIntegrationShort(gql.integration)!
        : undefined,
    creator:
      gql.creator !== undefined ? transformUserShort(gql.creator)! : undefined,
    git_tags: gql.gitTags ?? undefined,
    git_tag_messages: gql.gitTagMessages ?? undefined,
    git_branches: gql.gitBranches ?? undefined,
    git_branch_messages: gql.gitBranchMessages ?? undefined,
    git_folders_map: gql.gitFoldersMap ?? undefined,
    description: gql.description ?? undefined,
  };
}
