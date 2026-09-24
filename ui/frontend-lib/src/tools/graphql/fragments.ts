import {
  GraphqlFieldMap,
  buildNestedSelection,
  buildSelection,
} from "../../common/graphql/buildGraphqlFields";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const TOOL_GRAPHQL_FIELDS = {
  short: ["id", "name", "version", "os", "arch"] as const,
  base: [
    "id",
    "name",
    "version",
    "os",
    "arch",
    "executable",
    "sourceUrl",
    "sha256",
    "size",
    "status",
    "errorMessage",
    "isDefault",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  relations: {
    creator: "creator",
  } as const,
};

export const TOOL_SHORT_FIELDS = `
  ${buildSelection(TOOL_GRAPHQL_FIELDS.short)}
`;

export const TOOL_FIELDS = `
  ${buildSelection(TOOL_GRAPHQL_FIELDS.base)}
  ${buildNestedSelection(TOOL_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;

export const TOOL_DETAIL_FIELDS = `
  ${TOOL_FIELDS}
  resourcesCount
  executorsCount
`;

/** Maps table column fields to their GraphQL selection strings. */
export const TOOL_FIELD_MAP: GraphqlFieldMap = {
  creator: buildNestedSelection(
    TOOL_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
};
