import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const AUDIT_LOG_GRAPHQL_FIELDS = {
  base: [
    "id",
    "model",
    "userId",
    "action",
    "entityId",
    "createdAt",
    "revisionNumber",
  ] as const,
  relations: {
    creator: "creator",
  } as const,
};

export type AuditLogGraphqlBaseField =
  (typeof AUDIT_LOG_GRAPHQL_FIELDS.base)[number];
export type AuditLogGraphqlRelationKey =
  keyof typeof AUDIT_LOG_GRAPHQL_FIELDS.relations;
export type AuditLogGraphqlRelationField =
  (typeof AUDIT_LOG_GRAPHQL_FIELDS.relations)[AuditLogGraphqlRelationKey];

export const AUDIT_LOG_FIELDS = `
  ${buildSelection(AUDIT_LOG_GRAPHQL_FIELDS.base)}
  ${buildNestedSelection(AUDIT_LOG_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;

export const AUDIT_LOG_FIELD_MAP: GraphqlFieldMap = {
  creator: buildNestedSelection(
    AUDIT_LOG_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
};
