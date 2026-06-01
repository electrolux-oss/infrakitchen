import {
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { INTEGRATION_SHORT_FIELDS } from "../../integrations/graphql";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const SOURCE_CODE_GRAPHQL_FIELDS = {
  short: [
    "id",
    "identifier",
    "sourceCodeUrl",
    "sourceCodeProvider",
    "sourceCodeLanguage",
    "status",
  ] as const,
  list: [
    "id",
    "identifier",
    "description",
    "sourceCodeUrl",
    "sourceCodeProvider",
    "status",
    "labels",
    "updatedAt",
  ] as const,
  detail: [
    "id",
    "identifier",
    "description",
    "sourceCodeUrl",
    "sourceCodeProvider",
    "sourceCodeLanguage",
    "integrationId",
    "gitTags",
    "gitTagMessages",
    "gitBranches",
    "gitBranchMessages",
    "gitFoldersMap",
    "labels",
    "status",
    "revisionNumber",
    "createdAt",
    "updatedAt",
  ] as const,
  relations: {
    integration: "integration",
    creator: "creator",
  } as const,
};

export type SourceCodeGraphqlShortField =
  (typeof SOURCE_CODE_GRAPHQL_FIELDS.short)[number];
export type SourceCodeGraphqlDetailField =
  (typeof SOURCE_CODE_GRAPHQL_FIELDS.detail)[number];
export type SourceCodeGraphqlRelationKey =
  keyof typeof SOURCE_CODE_GRAPHQL_FIELDS.relations;
export type SourceCodeGraphqlRelationField =
  (typeof SOURCE_CODE_GRAPHQL_FIELDS.relations)[SourceCodeGraphqlRelationKey];

export const SOURCE_CODE_SHORT_FIELDS = `
  ${buildSelection(SOURCE_CODE_GRAPHQL_FIELDS.short)}
`;

export const SOURCE_CODE_LIST_FIELDS = `
  ${buildSelection(SOURCE_CODE_GRAPHQL_FIELDS.list)}
`;

export const SOURCE_CODE_DETAIL_FIELDS = `
  ${buildSelection(SOURCE_CODE_GRAPHQL_FIELDS.detail)}
  ${buildNestedSelection(SOURCE_CODE_GRAPHQL_FIELDS.relations.integration, INTEGRATION_SHORT_FIELDS)}
  ${buildNestedSelection(SOURCE_CODE_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;
