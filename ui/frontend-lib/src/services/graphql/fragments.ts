import {
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const SERVICE_GRAPHQL_FIELDS = {
  short: ["id", "name", "displayName", "entityName"] as const,
  list: [
    "id",
    "name",
    "displayName",
    "description",
    "labels",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  detail: [
    "id",
    "name",
    "displayName",
    "description",
    "projectId",
    "repositoryUrl",
    "labels",
    "revisionNumber",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  relations: {
    creator: "creator",
    owners: "owners",
    project: "project",
  } as const,
};

export type ServiceGraphqlShortField =
  | (typeof SERVICE_GRAPHQL_FIELDS.short)[number]
  | typeof SERVICE_GRAPHQL_FIELDS.relations.owners;
export type ServiceGraphqlDetailField =
  (typeof SERVICE_GRAPHQL_FIELDS.detail)[number];
export type ServiceGraphqlRelationKey =
  keyof typeof SERVICE_GRAPHQL_FIELDS.relations;
export type ServiceGraphqlRelationField =
  (typeof SERVICE_GRAPHQL_FIELDS.relations)[ServiceGraphqlRelationKey];

export const SERVICE_SHORT_FIELDS = `
  ${buildSelection(SERVICE_GRAPHQL_FIELDS.short)}
  ${buildNestedSelection(SERVICE_GRAPHQL_FIELDS.relations.owners, USER_SHORT_FIELDS)}
`;

export const SERVICE_LIST_FIELDS = `
  ${buildSelection(SERVICE_GRAPHQL_FIELDS.list)}
`;

const PROJECT_SHORT_FIELDS = `
  id
  name
`;

export const SERVICE_DETAIL_FIELDS = `
  ${buildSelection(SERVICE_GRAPHQL_FIELDS.detail)}
  ${buildNestedSelection(SERVICE_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
  ${buildNestedSelection(SERVICE_GRAPHQL_FIELDS.relations.owners, USER_SHORT_FIELDS)}
  ${buildNestedSelection(SERVICE_GRAPHQL_FIELDS.relations.project, PROJECT_SHORT_FIELDS)}
`;
