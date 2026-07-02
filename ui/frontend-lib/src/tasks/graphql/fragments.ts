import {
  buildNestedSelection,
  buildSelection,
  GraphqlFieldMap,
} from "../../common/graphql/buildGraphqlFields";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const TASK_GRAPHQL_FIELDS = {
  base: [
    "id",
    "entity",
    "entityId",
    "state",
    "status",
    "createdAt",
    "updatedAt",
    "entityData",
    "entityName",
  ] as const,
  relations: {
    creator: "creator",
  } as const,
} as const;

export type TaskGraphqlBaseField = (typeof TASK_GRAPHQL_FIELDS.base)[number];
export type TaskGraphqlRelationKey = keyof typeof TASK_GRAPHQL_FIELDS.relations;
export type TaskGraphqlRelationField =
  (typeof TASK_GRAPHQL_FIELDS.relations)[TaskGraphqlRelationKey];

export const TASK_DETAIL_FIELDS = `
  ${buildSelection(TASK_GRAPHQL_FIELDS.base)}
  ${buildNestedSelection(TASK_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;

export const TASK_FIELD_MAP: GraphqlFieldMap = {
  creator: buildNestedSelection(
    TASK_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
};
