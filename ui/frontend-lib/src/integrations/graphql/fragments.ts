import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { USER_SHORT_FIELDS } from "../../users/graphql/fragments";

export const INTEGRATION_GRAPHQL_FIELDS = {
  short: ["id", "name", "integrationProvider", "entityName"] as const,
  base: [
    "id",
    "name",
    "description",
    "integrationType",
    "integrationProvider",
    "configuration",
    "labels",
    "status",
    "revisionNumber",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  relations: {
    creator: "creator",
  } as const,
  details: [
    "resourceCount",
    "sourceCodeCount",
    "workspaceCount",
    "executorCount",
  ] as const,
};

export type IntegrationGraphqlShortField =
  (typeof INTEGRATION_GRAPHQL_FIELDS.short)[number];
export type IntegrationGraphqlBaseField =
  (typeof INTEGRATION_GRAPHQL_FIELDS.base)[number];
export type IntegrationGraphqlRelationKey =
  keyof typeof INTEGRATION_GRAPHQL_FIELDS.relations;
export type IntegrationGraphqlRelationField =
  (typeof INTEGRATION_GRAPHQL_FIELDS.relations)[IntegrationGraphqlRelationKey];
export type IntegrationGraphqlDetailsField =
  (typeof INTEGRATION_GRAPHQL_FIELDS.details)[number];

export const INTEGRATION_SHORT_FIELDS = `
  ${buildSelection(INTEGRATION_GRAPHQL_FIELDS.short)}
`;

export const INTEGRATION_FIELDS = `
  ${buildSelection(INTEGRATION_GRAPHQL_FIELDS.base)}
  ${buildNestedSelection(INTEGRATION_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;

export const INTEGRATION_DETAILS_FIELDS = `
  ${INTEGRATION_FIELDS}
  ${buildSelection(INTEGRATION_GRAPHQL_FIELDS.details)}
`;

/** Maps snake_case table column fields to their GraphQL selection strings. */
export const INTEGRATION_FIELD_MAP: GraphqlFieldMap = {
  creator: buildNestedSelection(
    INTEGRATION_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
};
