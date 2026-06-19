import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { SOURCE_CODE_SHORT_FIELDS } from "../../source_codes/graphql";
import { TEMPLATE_SHORT_FIELDS } from "../../templates/graphql";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const SCV_GRAPHQL_FIELDS = {
  short: [
    "id",
    "identifier",
    "sourceCodeVersion",
    "sourceCodeBranch",
    "sourceCodeFolder",
    "status",
    "entityName",
  ] as const,
  detail: [
    "id",
    "sourceCodeVersion",
    "sourceCodeBranch",
    "sourceCodeFolder",
    "variables",
    "outputs",
    "codeSnapshot",
    "description",
    "labels",
    "status",
    "revisionNumber",
    "resourcesCount",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  relations: {
    template: "template",
    sourceCode: "sourceCode",
    creator: "creator",
  } as const,
};

export type ScvGraphqlShortField = (typeof SCV_GRAPHQL_FIELDS.short)[number];
export type ScvGraphqlDetailField = (typeof SCV_GRAPHQL_FIELDS.detail)[number];
export type ScvGraphqlRelationKey = keyof typeof SCV_GRAPHQL_FIELDS.relations;
export type ScvGraphqlRelationField =
  (typeof SCV_GRAPHQL_FIELDS.relations)[ScvGraphqlRelationKey];

export const SCV_SHORT_FIELDS = `
  ${buildSelection(SCV_GRAPHQL_FIELDS.short)}
  ${buildNestedSelection(SCV_GRAPHQL_FIELDS.relations.sourceCode, SOURCE_CODE_SHORT_FIELDS)}
  ${buildNestedSelection(SCV_GRAPHQL_FIELDS.relations.template, TEMPLATE_SHORT_FIELDS)}
`;

export const SCV_REFERENCE_LIST_FIELDS = `
  id
  identifier
  entityName
  ${buildNestedSelection(SCV_GRAPHQL_FIELDS.relations.template, TEMPLATE_SHORT_FIELDS)}
  ${buildNestedSelection(SCV_GRAPHQL_FIELDS.relations.sourceCode, SOURCE_CODE_SHORT_FIELDS)}
  sourceCodeVersion
  sourceCodeBranch
  status
  createdAt
`;

export const SCV_FIELD_MAP: GraphqlFieldMap = {
  template: buildNestedSelection(
    SCV_GRAPHQL_FIELDS.relations.template,
    TEMPLATE_SHORT_FIELDS,
  ),
  sourceCode: buildNestedSelection(
    SCV_GRAPHQL_FIELDS.relations.sourceCode,
    SOURCE_CODE_SHORT_FIELDS,
  ),
  creator: buildNestedSelection(
    SCV_GRAPHQL_FIELDS.relations.creator,
    USER_SHORT_FIELDS,
  ),
};

export const SCV_CONFIG_FIELDS = `
  id
  createdAt
  updatedAt
  index
  sourceCodeVersionId
  required
  default
  frozen
  unique
  restricted
  sensitive
  name
  description
  type
  options
`;

export const SCV_TEMPLATE_REFERENCE_FIELDS = `
  id
  templateId
  referenceTemplateId
  inputConfigName
  outputConfigName
`;

export const SCV_TEMPLATE_OUTPUT_FIELDS = `
  name
  description
  createdAt
  updatedAt
  status
`;

export const TEMPLATE_PORTS_FIELDS = `
  template {
    id
    name
    abstract
    parents {
      id
      name
      abstract
    }
  }
  configs {
    name
  }
  outputs {
    name
  }
  references {
    referenceTemplateId
    templateId
    inputConfigName
    outputConfigName
  }
`;

export const SCV_DETAIL_FIELDS = `
  ${buildSelection(SCV_GRAPHQL_FIELDS.detail)}
  ${buildNestedSelection(SCV_GRAPHQL_FIELDS.relations.template, TEMPLATE_SHORT_FIELDS)}
  ${buildNestedSelection(SCV_GRAPHQL_FIELDS.relations.sourceCode, SOURCE_CODE_SHORT_FIELDS)}
  ${buildNestedSelection(SCV_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
`;
