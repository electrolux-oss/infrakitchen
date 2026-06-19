import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";

export const USER_GRAPHQL_FIELDS = {
  short: ["id", "identifier", "provider", "entityName"] as const,
  base: [
    "id",
    "identifier",
    "displayName",
    "email",
    "provider",
    "createdAt",
    "updatedAt",
    "description",
    "firstName",
    "lastName",
    "deactivated",
    "isPrimary",
    "entityName",
  ] as const,
  nested: {
    meta: "meta { slackId }",
  } as const,
  relations: {
    secondaryAccounts: "secondaryAccounts",
    primaryAccount: "primaryAccount",
  } as const,
};

export type UserGraphqlShortField = (typeof USER_GRAPHQL_FIELDS.short)[number];
export type UserGraphqlBaseField = (typeof USER_GRAPHQL_FIELDS.base)[number];
export type UserGraphqlRelationKey = keyof typeof USER_GRAPHQL_FIELDS.relations;
export type UserGraphqlRelationField =
  (typeof USER_GRAPHQL_FIELDS.relations)[UserGraphqlRelationKey];

export const USER_SHORT_FIELDS = `
  ${buildSelection(USER_GRAPHQL_FIELDS.short)}
`;

export const USER_FIELDS = `
  ${buildSelection(USER_GRAPHQL_FIELDS.base)}
  ${USER_GRAPHQL_FIELDS.nested.meta}
  ${buildNestedSelection(USER_GRAPHQL_FIELDS.relations.secondaryAccounts, USER_SHORT_FIELDS)}
  ${buildNestedSelection(USER_GRAPHQL_FIELDS.relations.primaryAccount, USER_SHORT_FIELDS)}
`;

/** Maps table column fields to their GraphQL selection strings. */
export const USER_FIELD_MAP: GraphqlFieldMap = {
  secondaryAccounts: buildNestedSelection(
    USER_GRAPHQL_FIELDS.relations.secondaryAccounts,
    USER_SHORT_FIELDS,
  ),
  primaryAccount: buildNestedSelection(
    USER_GRAPHQL_FIELDS.relations.primaryAccount,
    USER_SHORT_FIELDS,
  ),
};
