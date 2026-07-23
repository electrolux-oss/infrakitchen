import {
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const PROJECT_GRAPHQL_FIELDS = {
  short: ["id", "name", "status", "entityName"] as const,
  list: [
    "id",
    "name",
    "description",
    "labels",
    "status",
    "resourcesCount",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  detail: [
    "id",
    "name",
    "description",
    "workspaceId",
    "configuration",
    "dependencyTags",
    "dependencyConfig",
    "labels",
    "status",
    "revisionNumber",
    "resourcesCount",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  relations: {
    creator: "creator",
    owners: "owners",
    workspace: "workspace",
  } as const,
};

export type ProjectGraphqlShortField =
  | (typeof PROJECT_GRAPHQL_FIELDS.short)[number]
  | typeof PROJECT_GRAPHQL_FIELDS.relations.owners;
export type ProjectGraphqlDetailField =
  (typeof PROJECT_GRAPHQL_FIELDS.detail)[number];
export type ProjectGraphqlRelationKey =
  keyof typeof PROJECT_GRAPHQL_FIELDS.relations;
export type ProjectGraphqlRelationField =
  (typeof PROJECT_GRAPHQL_FIELDS.relations)[ProjectGraphqlRelationKey];

export const PROJECT_SHORT_FIELDS = `
  ${buildSelection(PROJECT_GRAPHQL_FIELDS.short)}
  ${buildNestedSelection(PROJECT_GRAPHQL_FIELDS.relations.owners, USER_SHORT_FIELDS)}
`;

export const PROJECT_LIST_FIELDS = `
  ${buildSelection(PROJECT_GRAPHQL_FIELDS.list)}
`;

const WORKSPACE_SHORT_FIELDS = `
  id
  name
`;

export const PROJECT_DETAIL_FIELDS = `
  ${buildSelection(PROJECT_GRAPHQL_FIELDS.detail)}
  ${buildNestedSelection(PROJECT_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
  ${buildNestedSelection(PROJECT_GRAPHQL_FIELDS.relations.owners, USER_SHORT_FIELDS)}
  ${buildNestedSelection(PROJECT_GRAPHQL_FIELDS.relations.workspace, WORKSPACE_SHORT_FIELDS)}
`;
