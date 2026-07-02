import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { SOURCE_CODE_SHORT_FIELDS } from "../../source_codes/graphql";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const EXECUTOR_INTEGRATION_SHORT_FIELDS = `
  id
  name
  integrationProvider
`;

export const EXECUTOR_SECRET_SHORT_FIELDS = `
  id
  name
  secretProvider
`;

export const EXECUTOR_STORAGE_SHORT_FIELDS = `
  id
  name
  storageProvider
`;

export const EXECUTOR_GRAPHQL_FIELDS = {
  base: [
    "id",
    "name",
    "description",
    "runtime",
    "commandArgs",
    "sourceCodeVersion",
    "sourceCodeBranch",
    "sourceCodeFolder",
    "storagePath",
    "labels",
    "state",
    "status",
    "revisionNumber",
    "createdAt",
    "updatedAt",
    "isFavorite",
    "entityName",
  ] as const,
  relations: {
    sourceCode: "sourceCode",
    integrationIds: "integrationIds",
    secretIds: "secretIds",
    storage: "storage",
    creator: "creator",
  } as const,
};

export type ExecutorGraphqlBaseField =
  (typeof EXECUTOR_GRAPHQL_FIELDS.base)[number];
export type ExecutorGraphqlRelationKey =
  keyof typeof EXECUTOR_GRAPHQL_FIELDS.relations;
export type ExecutorGraphqlRelationField =
  (typeof EXECUTOR_GRAPHQL_FIELDS.relations)[ExecutorGraphqlRelationKey];

export const EXECUTOR_LIST_FIELDS = `
  ${buildSelection(EXECUTOR_GRAPHQL_FIELDS.base)}
  ${buildNestedSelection(EXECUTOR_GRAPHQL_FIELDS.relations.sourceCode, SOURCE_CODE_SHORT_FIELDS)}
  ${buildNestedSelection(EXECUTOR_GRAPHQL_FIELDS.relations.integrationIds, EXECUTOR_INTEGRATION_SHORT_FIELDS)}
  ${buildNestedSelection(EXECUTOR_GRAPHQL_FIELDS.relations.secretIds, EXECUTOR_SECRET_SHORT_FIELDS)}
  ${buildNestedSelection(EXECUTOR_GRAPHQL_FIELDS.relations.storage, EXECUTOR_STORAGE_SHORT_FIELDS)}
  ${buildNestedSelection(EXECUTOR_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;

export const EXECUTOR_FIELD_MAP: GraphqlFieldMap = {
  sourceCode: buildNestedSelection(
    EXECUTOR_GRAPHQL_FIELDS.relations.sourceCode,
    SOURCE_CODE_SHORT_FIELDS,
  ),
  integrationIds: buildNestedSelection(
    EXECUTOR_GRAPHQL_FIELDS.relations.integrationIds,
    EXECUTOR_INTEGRATION_SHORT_FIELDS,
  ),
  secretIds: buildNestedSelection(
    EXECUTOR_GRAPHQL_FIELDS.relations.secretIds,
    EXECUTOR_SECRET_SHORT_FIELDS,
  ),
  storage: buildNestedSelection(
    EXECUTOR_GRAPHQL_FIELDS.relations.storage,
    EXECUTOR_STORAGE_SHORT_FIELDS,
  ),
  creator: buildNestedSelection(
    EXECUTOR_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
};

export const EXECUTOR_DETAIL_FIELDS = EXECUTOR_LIST_FIELDS;
