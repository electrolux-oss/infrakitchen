import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { INTEGRATION_SHORT_FIELDS } from "../../integrations/graphql";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const SECRET_GRAPHQL_FIELDS = {
  short: ["id", "name", "secretType", "secretProvider"] as const,
  base: [
    "id",
    "name",
    "secretType",
    "secretProvider",
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
  ] as const,
  relations: {
    integration: "integration",
    creator: "creator",
  } as const,
};

export type SecretGraphqlShortField =
  (typeof SECRET_GRAPHQL_FIELDS.short)[number];
export type SecretGraphqlBaseField =
  (typeof SECRET_GRAPHQL_FIELDS.base)[number];
export type SecretGraphqlRelationKey =
  keyof typeof SECRET_GRAPHQL_FIELDS.relations;
export type SecretGraphqlRelationField =
  (typeof SECRET_GRAPHQL_FIELDS.relations)[SecretGraphqlRelationKey];

export const SECRET_SHORT_FIELDS = `
  ${buildSelection(SECRET_GRAPHQL_FIELDS.short)}
`;

export const SECRET_DETAIL_FIELDS = `
  ${buildSelection(SECRET_GRAPHQL_FIELDS.base)}
  ${buildNestedSelection(SECRET_GRAPHQL_FIELDS.relations.integration, INTEGRATION_SHORT_FIELDS)}
  ${buildNestedSelection(SECRET_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;

/** Maps snake_case table column fields to their GraphQL selection strings. */
export const SECRET_FIELD_MAP: GraphqlFieldMap = {
  integration: buildNestedSelection(
    SECRET_GRAPHQL_FIELDS.relations.integration,
    INTEGRATION_SHORT_FIELDS,
  ),
  creator: buildNestedSelection(
    SECRET_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
};
