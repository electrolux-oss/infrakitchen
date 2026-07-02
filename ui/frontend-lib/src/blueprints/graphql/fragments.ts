import {
  GraphqlFieldMap,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { TEMPLATE_SHORT_FIELDS } from "../../templates/graphql";
import { USER_SHORT_FIELDS } from "../../users/graphql";
import { WORKFLOW_STEP_SHORT_FIELDS } from "../../workflows/graphql/fragments";

export const BLUEPRINT_GRAPHQL_FIELDS = {
  relations: {
    templates: "templates",
    externalTemplates: "externalTemplates",
    creator: "creator",
  } as const,
};

export type BlueprintGraphqlRelationKey =
  keyof typeof BLUEPRINT_GRAPHQL_FIELDS.relations;
export type BlueprintGraphqlRelationField =
  (typeof BLUEPRINT_GRAPHQL_FIELDS.relations)[BlueprintGraphqlRelationKey];

export const BLUEPRINT_LIST_FIELDS = `
  id
  name
  description
  entityName
  ${buildNestedSelection(BLUEPRINT_GRAPHQL_FIELDS.relations.templates, TEMPLATE_SHORT_FIELDS)}
  labels
  status
  updatedAt
`;

export const BLUEPRINT_FIELDS = `
  id
  name
  description
  entityName
  ${buildNestedSelection(BLUEPRINT_GRAPHQL_FIELDS.relations.templates, TEMPLATE_SHORT_FIELDS)}
  ${buildNestedSelection(BLUEPRINT_GRAPHQL_FIELDS.relations.externalTemplates, TEMPLATE_SHORT_FIELDS)}
  wiring
  defaultVariables
  configuration
  labels
  status
  revisionNumber
  ${buildNestedSelection(BLUEPRINT_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
  workflows {
    id
    action
    status
    errorMessage
    steps {
      ${WORKFLOW_STEP_SHORT_FIELDS}
      template {
        id
        name
      }
      resource {
        id
        name
      }
      position
      errorMessage
      startedAt
      completedAt
    }
    startedAt
    completedAt
    createdAt
  }
  createdAt
  updatedAt
`;

export const BLUEPRINT_USE_FIELDS = `
  id
  name
  ${buildNestedSelection(
    BLUEPRINT_GRAPHQL_FIELDS.relations.templates,
    `
    ${TEMPLATE_SHORT_FIELDS}
    parents {
      ${TEMPLATE_SHORT_FIELDS}
    }
  `,
  )}
  ${buildNestedSelection(BLUEPRINT_GRAPHQL_FIELDS.relations.externalTemplates, TEMPLATE_SHORT_FIELDS)}
  wiring
  configuration
`;

export const BLUEPRINT_FIELD_MAP: GraphqlFieldMap = {
  creator: buildNestedSelection(
    BLUEPRINT_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
  templates: buildNestedSelection(
    BLUEPRINT_GRAPHQL_FIELDS.relations.templates,
    TEMPLATE_SHORT_FIELDS,
  ),
  externalTemplates: buildNestedSelection(
    BLUEPRINT_GRAPHQL_FIELDS.relations.externalTemplates,
    TEMPLATE_SHORT_FIELDS,
  ),
};
