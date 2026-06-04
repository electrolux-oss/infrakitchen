import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const BATCH_OPERATION_GRAPHQL_FIELDS = {
  base: [
    "id",
    "name",
    "description",
    "entityType",
    "entityIds",
    "createdAt",
    "updatedAt",
  ] as const,
  relations: {
    creator: "creator",
  } as const,
};

export type BatchOperationGraphqlBaseField =
  (typeof BATCH_OPERATION_GRAPHQL_FIELDS.base)[number];
export type BatchOperationGraphqlRelationKey =
  keyof typeof BATCH_OPERATION_GRAPHQL_FIELDS.relations;
export type BatchOperationGraphqlRelationField =
  (typeof BATCH_OPERATION_GRAPHQL_FIELDS.relations)[BatchOperationGraphqlRelationKey];

export const BATCH_OPERATION_FIELDS = `
  ${buildSelection(BATCH_OPERATION_GRAPHQL_FIELDS.base)}
  ${buildNestedSelection(BATCH_OPERATION_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;

export const BATCH_OPERATION_FIELD_MAP: GraphqlFieldMap = {
  creator: buildNestedSelection(
    BATCH_OPERATION_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
};
