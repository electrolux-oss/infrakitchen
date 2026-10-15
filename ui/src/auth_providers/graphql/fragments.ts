import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const AUTH_PROVIDER_GRAPHQL_FIELDS = {
  base: [
    "id",
    "name",
    "description",
    "enabled",
    "authProvider",
    "configuration",
    "filterByDomain",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  relations: {
    creator: "creator",
  } as const,
};

export type AuthProviderGraphqlBaseField =
  (typeof AUTH_PROVIDER_GRAPHQL_FIELDS.base)[number];
export type AuthProviderGraphqlRelationKey =
  keyof typeof AUTH_PROVIDER_GRAPHQL_FIELDS.relations;
export type AuthProviderGraphqlRelationField =
  (typeof AUTH_PROVIDER_GRAPHQL_FIELDS.relations)[AuthProviderGraphqlRelationKey];

export const AUTH_PROVIDER_FIELDS = `
  ${buildSelection(AUTH_PROVIDER_GRAPHQL_FIELDS.base)}
  ${buildNestedSelection(AUTH_PROVIDER_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;

export const AUTH_PROVIDER_FIELD_MAP: GraphqlFieldMap = {
  creator: buildNestedSelection(
    AUTH_PROVIDER_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
};
