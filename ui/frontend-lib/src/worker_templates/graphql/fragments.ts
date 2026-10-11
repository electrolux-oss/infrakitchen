import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const WORKER_TEMPLATE_GRAPHQL_FIELDS = {
  base: [
    "id",
    "name",
    "description",
    "provider",
    "configuration",
    "maxWorkers",
    "idleTimeoutSeconds",
    "priority",
    "lastError",
    "labels",
    "state",
    "status",
    "revisionNumber",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  relations: {
    creator: "creator",
  } as const,
};

export type WorkerTemplateGraphqlBaseField =
  (typeof WORKER_TEMPLATE_GRAPHQL_FIELDS.base)[number];
export type WorkerTemplateGraphqlRelationKey =
  keyof typeof WORKER_TEMPLATE_GRAPHQL_FIELDS.relations;
export type WorkerTemplateGraphqlRelationField =
  (typeof WORKER_TEMPLATE_GRAPHQL_FIELDS.relations)[WorkerTemplateGraphqlRelationKey];

export const WORKER_TEMPLATE_DETAIL_FIELDS = `
  ${buildSelection(WORKER_TEMPLATE_GRAPHQL_FIELDS.base)}
  ${buildNestedSelection(WORKER_TEMPLATE_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;

/** Maps snake_case table column fields to their GraphQL selection strings. */
export const WORKER_TEMPLATE_FIELD_MAP: GraphqlFieldMap = {
  creator: buildNestedSelection(
    WORKER_TEMPLATE_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
};
