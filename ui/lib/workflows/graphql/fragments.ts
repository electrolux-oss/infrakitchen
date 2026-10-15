import {
  GraphqlFieldMap,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { INTEGRATION_SHORT_FIELDS } from "../../integrations/graphql";
import { RESOURCE_SHORT_FIELDS } from "../../resources/graphql";
import { SECRET_SHORT_FIELDS } from "../../secrets/graphql";
import { SCV_SHORT_FIELDS } from "../../source_code_versions/graphql";
import { TEMPLATE_SHORT_FIELDS } from "../../templates/graphql";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const WORKFLOW_STEP_SHORT_FIELDS = `
  id
  status
`;

export const WORKFLOW_STEP_FIELDS = `
  id
  ${buildNestedSelection("template", TEMPLATE_SHORT_FIELDS)}
  ${buildNestedSelection("resource", RESOURCE_SHORT_FIELDS)}
  ${buildNestedSelection("sourceCodeVersion", SCV_SHORT_FIELDS)}
  parentResourceIds {
    id
    name
    status
    template {
      id
      name
    }
  }
  ${buildNestedSelection("integrationIds", INTEGRATION_SHORT_FIELDS)}
  ${buildNestedSelection("secretIds", SECRET_SHORT_FIELDS)}
  storageId
  position
  status
  errorMessage
  resolvedVariables
  startedAt
  completedAt
`;

export const WORKFLOW_LIST_FIELDS = `
  id
  action
  entityName
  status
  errorMessage
  ${buildNestedSelection("creator", USER_SHORT_FIELDS)}
  steps {
    ${WORKFLOW_STEP_SHORT_FIELDS}
  }
  startedAt
  completedAt
  createdAt
`;

export const WORKFLOW_FIELDS = `
  id
  action
  entityName
  wiringSnapshot
  status
  errorMessage
  ${buildNestedSelection("creator", USER_SHORT_FIELDS)}
  steps {
    ${WORKFLOW_STEP_FIELDS}
  }
  startedAt
  completedAt
  createdAt
`;

export const WORKFLOW_FIELD_MAP: GraphqlFieldMap = {
  creator: buildNestedSelection("creator", USER_SHORT_FIELDS),
  steps: `steps { ${WORKFLOW_STEP_SHORT_FIELDS} }`,
};
