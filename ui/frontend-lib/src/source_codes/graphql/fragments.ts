import {
  GraphqlFieldMap,
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
    "entityName",
  ] as const,
  list: [
    "id",
    "identifier",
    "description",
    "sourceCodeUrl",
    "sourceCodeProvider",
    "repositoryType",
    "status",
    "labels",
    "updatedAt",
    "entityName",
  ] as const,
  detail: [
    "id",
    "identifier",
    "description",
    "sourceCodeUrl",
    "sourceCodeProvider",
    "sourceCodeLanguage",
    "repositoryType",
    "integrationId",
    "gitTags",
    "gitTagMessages",
    "gitBranches",
    "gitBranchMessages",
    "gitFoldersMap",
    "defaultBranch",
    "gitTagShas",
    "commitCount",
    "iacEnvironmentNames",
    "labels",
    "status",
    "revisionNumber",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  relations: {
    integration: "integration",
    creator: "creator",
    iacModules: "iacModules",
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

export const SOURCE_CODE_FIELD_MAP: GraphqlFieldMap = {
  integration: buildNestedSelection(
    SOURCE_CODE_GRAPHQL_FIELDS.relations.integration,
    INTEGRATION_SHORT_FIELDS,
  ),
  creator: buildNestedSelection(
    SOURCE_CODE_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
};

const IAC_MODULE_FIELDS = `
  name
  path
  environments {
    name
    workingDir
    varFiles
    regions {
      name
      workingDir
      varFiles
    }
  }
  variables {
    name
    type
    description
    required
    sensitive
  }
`;

export const SOURCE_CODE_DETAIL_FIELDS = `
  ${buildSelection(SOURCE_CODE_GRAPHQL_FIELDS.detail)}
  ${buildNestedSelection(SOURCE_CODE_GRAPHQL_FIELDS.relations.integration, INTEGRATION_SHORT_FIELDS)}
  ${buildNestedSelection(SOURCE_CODE_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
  ${buildNestedSelection(SOURCE_CODE_GRAPHQL_FIELDS.relations.iacModules, IAC_MODULE_FIELDS)}
`;
