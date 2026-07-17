import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { INTEGRATION_SHORT_FIELDS } from "../../integrations/graphql";
import { PROJECT_SHORT_FIELDS } from "../../projects/graphql";
import { SECRET_SHORT_FIELDS } from "../../secrets/graphql";
import { SCV_SHORT_FIELDS } from "../../source_code_versions/graphql";
import { STORAGE_SHORT_FIELDS } from "../../storages/graphql";
import { TEMPLATE_SHORT_FIELDS } from "../../templates/graphql";
import { USER_SHORT_FIELDS } from "../../users/graphql";
import { WORKSPACE_SHORT_FIELDS } from "../../workspaces/graphql";

export const RESOURCE_GRAPHQL_FIELDS = {
  short: ["id", "name", "state", "status", "isFavorite", "entityName"] as const,
  detail: [
    "id",
    "name",
    "description",
    "abstract",
    "revisionNumber",
    "storagePath",
    "variables",
    "outputs",
    "dependencyTags",
    "dependencyConfig",
    "state",
    "status",
    "createdAt",
    "updatedAt",
    "labels",
    "isFavorite",
    "entityName",
  ] as const,
  relations: {
    template: "template",
    sourceCodeVersion: "sourceCodeVersion",
    integrationIds: "integrationIds",
    secretIds: "secretIds",
    storage: "storage",
    creator: "creator",
    parents: "parents",
    children: "children",
    workspace: "workspace",
    project: "project",
  } as const,
};

export type ResourceGraphqlShortField =
  (typeof RESOURCE_GRAPHQL_FIELDS.short)[number];
export type ResourceGraphqlDetailField =
  (typeof RESOURCE_GRAPHQL_FIELDS.detail)[number];
export type ResourceGraphqlRelationKey =
  keyof typeof RESOURCE_GRAPHQL_FIELDS.relations;
export type ResourceGraphqlRelationField =
  (typeof RESOURCE_GRAPHQL_FIELDS.relations)[ResourceGraphqlRelationKey];

export const RESOURCE_SHORT_FIELDS = `
  ${buildSelection(RESOURCE_GRAPHQL_FIELDS.short)}
  ${buildNestedSelection(RESOURCE_GRAPHQL_FIELDS.relations.template, TEMPLATE_SHORT_FIELDS)}
`;

export const RESOURCE_DETAIL_FIELDS = `
  ${buildSelection(RESOURCE_GRAPHQL_FIELDS.detail)}
  ${buildNestedSelection(RESOURCE_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
  ${buildNestedSelection(RESOURCE_GRAPHQL_FIELDS.relations.template, TEMPLATE_SHORT_FIELDS)}
  ${buildNestedSelection(RESOURCE_GRAPHQL_FIELDS.relations.sourceCodeVersion, SCV_SHORT_FIELDS)}
  ${buildNestedSelection(RESOURCE_GRAPHQL_FIELDS.relations.integrationIds, INTEGRATION_SHORT_FIELDS)}
  ${buildNestedSelection(RESOURCE_GRAPHQL_FIELDS.relations.secretIds, SECRET_SHORT_FIELDS)}
  ${buildNestedSelection(RESOURCE_GRAPHQL_FIELDS.relations.storage, STORAGE_SHORT_FIELDS)}
  ${buildNestedSelection(RESOURCE_GRAPHQL_FIELDS.relations.parents, RESOURCE_SHORT_FIELDS)}
  ${buildNestedSelection(RESOURCE_GRAPHQL_FIELDS.relations.children, RESOURCE_SHORT_FIELDS)}
  ${buildNestedSelection(RESOURCE_GRAPHQL_FIELDS.relations.workspace, WORKSPACE_SHORT_FIELDS)}
  ${buildNestedSelection(RESOURCE_GRAPHQL_FIELDS.relations.project, PROJECT_SHORT_FIELDS)}
`;

export const RESOURCE_TEMP_STATE_FIELDS = `
  id
  resourceId
  value
  createdAt
  updatedAt
`;

/** Maps snake_case table column fields to their GraphQL selection strings. */
export const RESOURCE_FIELD_MAP: GraphqlFieldMap = {
  sourceCodeVersion: buildNestedSelection(
    RESOURCE_GRAPHQL_FIELDS.relations.sourceCodeVersion,
    SCV_SHORT_FIELDS,
  ),
  integrationIds: buildNestedSelection(
    RESOURCE_GRAPHQL_FIELDS.relations.integrationIds,
    INTEGRATION_SHORT_FIELDS,
  ),
  secretIds: buildNestedSelection(
    RESOURCE_GRAPHQL_FIELDS.relations.secretIds,
    SECRET_SHORT_FIELDS,
  ),
  template: buildNestedSelection(
    RESOURCE_GRAPHQL_FIELDS.relations.template,
    TEMPLATE_SHORT_FIELDS,
  ),
  creator: buildNestedSelection(
    RESOURCE_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
  storage: buildNestedSelection(
    RESOURCE_GRAPHQL_FIELDS.relations.storage,
    STORAGE_SHORT_FIELDS,
  ),
  workspace: buildNestedSelection(
    RESOURCE_GRAPHQL_FIELDS.relations.workspace,
    WORKSPACE_SHORT_FIELDS,
  ),
  project: buildNestedSelection(
    RESOURCE_GRAPHQL_FIELDS.relations.project,
    PROJECT_SHORT_FIELDS,
  ),
  parents: buildNestedSelection(
    RESOURCE_GRAPHQL_FIELDS.relations.parents,
    RESOURCE_SHORT_FIELDS,
  ),
  children: buildNestedSelection(
    RESOURCE_GRAPHQL_FIELDS.relations.children,
    RESOURCE_SHORT_FIELDS,
  ),
};
