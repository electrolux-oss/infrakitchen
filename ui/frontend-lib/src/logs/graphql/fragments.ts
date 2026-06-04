import {
  GraphqlFieldMap,
  buildSelection,
} from "../../common/graphql/buildGraphqlFields";

export const LOG_GRAPHQL_FIELDS = {
  short: ["id", "entityId", "entity", "level", "createdAt"] as const,
  base: [
    "id",
    "entityId",
    "entity",
    "revision",
    "auditLogId",
    "level",
    "data",
    "createdAt",
    "executionStart",
    "expireAt",
    "traceId",
  ] as const,
};

export type LogGraphqlShortField = (typeof LOG_GRAPHQL_FIELDS.short)[number];
export type LogGraphqlBaseField = (typeof LOG_GRAPHQL_FIELDS.base)[number];

export const LOG_SHORT_FIELDS = `
  ${buildSelection(LOG_GRAPHQL_FIELDS.short)}
`;

export const LOG_DETAIL_FIELDS = `
  ${buildSelection(LOG_GRAPHQL_FIELDS.base)}
`;

export const LOG_FIELD_MAP: GraphqlFieldMap = {};
