import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { INTEGRATION_SHORT_FIELDS } from "../../integrations/graphql";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const STORAGE_GRAPHQL_FIELDS = {
  short: ["id", "name", "storageProvider", "entityName"] as const,
  base: [
    "id",
    "name",
    "storageType",
    "storageProvider",
    "configuration",
    "description",
    "labels",
    "state",
    "status",
    "resourcesCount",
    "executorsCount",
    "revisionNumber",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  relations: {
    integration: "integration",
    creator: "creator",
  } as const,
};

export type StorageGraphqlShortField =
  (typeof STORAGE_GRAPHQL_FIELDS.short)[number];
export type StorageGraphqlBaseField =
  (typeof STORAGE_GRAPHQL_FIELDS.base)[number];
export type StorageGraphqlRelationKey =
  keyof typeof STORAGE_GRAPHQL_FIELDS.relations;
export type StorageGraphqlRelationField =
  (typeof STORAGE_GRAPHQL_FIELDS.relations)[StorageGraphqlRelationKey];

export const STORAGE_SHORT_FIELDS = `
  ${buildSelection(STORAGE_GRAPHQL_FIELDS.short)}
`;

export const STORAGE_DETAIL_FIELDS = `
  ${buildSelection(STORAGE_GRAPHQL_FIELDS.base)}
  ${buildNestedSelection(STORAGE_GRAPHQL_FIELDS.relations.integration, INTEGRATION_SHORT_FIELDS)}
  ${buildNestedSelection(STORAGE_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;

/** Maps snake_case table column fields to their GraphQL selection strings. */
export const STORAGE_FIELD_MAP: GraphqlFieldMap = {
  integration: buildNestedSelection(
    STORAGE_GRAPHQL_FIELDS.relations.integration,
    INTEGRATION_SHORT_FIELDS,
  ),
  creator: buildNestedSelection(
    STORAGE_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
};
