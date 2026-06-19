import {
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const TEMPLATE_GRAPHQL_FIELDS = {
  short: [
    "id",
    "name",
    "abstract",
    "cloudResourceTypes",
    "entityName",
  ] as const,
  list: [
    "id",
    "name",
    "description",
    "labels",
    "status",
    "abstract",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  detail: [
    "id",
    "name",
    "description",
    "documentation",
    "template",
    "cloudResourceTypes",
    "abstract",
    "configuration",
    "labels",
    "status",
    "revisionNumber",
    "resourcesCount",
    "sourceCodeVersionsCount",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  relations: {
    creator: "creator",
    parents: "parents",
    children: "children",
  } as const,
};

export type TemplateGraphqlShortField =
  (typeof TEMPLATE_GRAPHQL_FIELDS.short)[number];
export type TemplateGraphqlDetailField =
  (typeof TEMPLATE_GRAPHQL_FIELDS.detail)[number];
export type TemplateGraphqlRelationKey =
  keyof typeof TEMPLATE_GRAPHQL_FIELDS.relations;
export type TemplateGraphqlRelationField =
  (typeof TEMPLATE_GRAPHQL_FIELDS.relations)[TemplateGraphqlRelationKey];

export const TEMPLATE_SHORT_FIELDS = `
  ${buildSelection(TEMPLATE_GRAPHQL_FIELDS.short)}
`;

export const TEMPLATE_LIST_FIELDS = `
  ${buildSelection(TEMPLATE_GRAPHQL_FIELDS.list)}
`;

export const TEMPLATE_DETAIL_FIELDS = `
  ${buildSelection(TEMPLATE_GRAPHQL_FIELDS.detail)}
  ${buildNestedSelection(TEMPLATE_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
  ${buildNestedSelection(TEMPLATE_GRAPHQL_FIELDS.relations.parents, TEMPLATE_SHORT_FIELDS)}
  ${buildNestedSelection(TEMPLATE_GRAPHQL_FIELDS.relations.children, TEMPLATE_SHORT_FIELDS)}
`;

// Recursive tree fragment — supports up to 5 levels of nesting
const TREE_NODE_FIELDS = `
  id
  nodeId
  name
  status
`;

export const TEMPLATE_TREE_FIELDS = `
  ${TREE_NODE_FIELDS}
  children {
    ${TREE_NODE_FIELDS}
    children {
      ${TREE_NODE_FIELDS}
      children {
        ${TREE_NODE_FIELDS}
        children {
          ${TREE_NODE_FIELDS}
        }
      }
    }
  }
`;
