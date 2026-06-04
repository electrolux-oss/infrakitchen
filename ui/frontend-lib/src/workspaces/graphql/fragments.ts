import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { INTEGRATION_SHORT_FIELDS } from "../../integrations/graphql";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const WORKSPACE_GRAPHQL_FIELDS = {
  short: ["id", "name", "workspaceProvider"] as const,
  list: [
    "id",
    "name",
    "workspaceProvider",
    "status",
    "description",
    "labels",
    "createdAt",
    "updatedAt",
  ] as const,
  detail: [
    "id",
    "name",
    "workspaceProvider",
    "configuration",
    "status",
    "description",
    "labels",
    "resourcesCount",
    "createdAt",
    "updatedAt",
  ] as const,
  relations: {
    integration: "integration",
    creator: "creator",
  } as const,
};

export type WorkspaceGraphqlShortField =
  (typeof WORKSPACE_GRAPHQL_FIELDS.short)[number];
export type WorkspaceGraphqlDetailField =
  (typeof WORKSPACE_GRAPHQL_FIELDS.detail)[number];
export type WorkspaceGraphqlRelationKey =
  keyof typeof WORKSPACE_GRAPHQL_FIELDS.relations;
export type WorkspaceGraphqlRelationField =
  (typeof WORKSPACE_GRAPHQL_FIELDS.relations)[WorkspaceGraphqlRelationKey];

export const WORKSPACE_SHORT_FIELDS = `
  ${buildSelection(WORKSPACE_GRAPHQL_FIELDS.short)}
`;

export const WORKSPACE_LIST_FIELDS = `
  ${buildSelection(WORKSPACE_GRAPHQL_FIELDS.list)}
  ${buildNestedSelection(WORKSPACE_GRAPHQL_FIELDS.relations.integration, INTEGRATION_SHORT_FIELDS)}
  ${buildNestedSelection(WORKSPACE_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;

export const WORKSPACE_DETAIL_FIELDS = `
  ${buildSelection(WORKSPACE_GRAPHQL_FIELDS.detail)}
  ${buildNestedSelection(WORKSPACE_GRAPHQL_FIELDS.relations.integration, INTEGRATION_SHORT_FIELDS)}
  ${buildNestedSelection(WORKSPACE_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;

/** Maps snake_case table column fields to their GraphQL selection strings. */
export const WORKSPACE_FIELD_MAP: GraphqlFieldMap = {
  integration: buildNestedSelection(
    WORKSPACE_GRAPHQL_FIELDS.relations.integration,
    INTEGRATION_SHORT_FIELDS,
  ),
  creator: buildNestedSelection(
    WORKSPACE_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
};
