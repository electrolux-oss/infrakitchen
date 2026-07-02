import { TEMPLATE_TREE_FIELDS } from "../../templates/graphql/fragments";
import {
  VALIDATION_RULE_FIELDS,
  VALIDATION_RULES_BY_VARIABLE_FIELDS,
} from "../../validation_rules/graphql/fragments";

import {
  SCV_CONFIG_FIELDS,
  SCV_DETAIL_FIELDS,
  SCV_REFERENCE_LIST_FIELDS,
  TEMPLATE_PORTS_FIELDS,
  SCV_TEMPLATE_OUTPUT_FIELDS,
  SCV_TEMPLATE_REFERENCE_FIELDS,
} from "./fragments";

export const SOURCE_CODE_VERSION_QUERY = `
  query SourceCodeVersion($id: UUID!) {
    sourceCodeVersion(id: $id) {
      ${SCV_DETAIL_FIELDS}
    }
  }
`;

export const SOURCE_CODE_VERSION_CONFIGS_QUERY = `
  query SourceCodeVersionConfigs($sourceCodeVersionId: UUID!) {
    sourceCodeVersionConfigs(sourceCodeVersionId: $sourceCodeVersionId) {
      ${SCV_CONFIG_FIELDS}
    }
  }
`;

export const SOURCE_CODE_VERSION_CONFIGS_WITH_VALIDATION_QUERY = `
  query SourceCodeVersionConfigsWithValidation($sourceCodeVersionId: UUID!, $templateId: UUID!) {
    sourceCodeVersionConfigs(sourceCodeVersionId: $sourceCodeVersionId) {
      ${SCV_CONFIG_FIELDS}
    }
    validationRulesByTemplate(templateId: $templateId) {
      ${VALIDATION_RULES_BY_VARIABLE_FIELDS}
    }
  }
`;

export const SOURCE_CODE_VERSION_TEMPLATE_OUTPUTS_QUERY = `
  query SourceCodeVersionTemplateOutputs($templateId: UUID!) {
    sourceCodeVersionTemplateOutputs(templateId: $templateId) {
      ${SCV_TEMPLATE_OUTPUT_FIELDS}
    }
  }
`;

export const SOURCE_CODE_VERSION_TEMPLATE_CONFIGS_QUERY = `
  query SourceCodeVersionTemplateConfigs($templateId: UUID!) {
    sourceCodeVersionTemplateConfigs(templateId: $templateId) {
      ${SCV_CONFIG_FIELDS}
    }
  }
`;

export const TEMPLATE_PORTS_QUERY = `
  query TemplatePorts($templateIds: [UUID!]!) {
    templatePorts(templateIds: $templateIds) {
      ${TEMPLATE_PORTS_FIELDS}
    }
  }
`;

export const SOURCE_CODE_VERSION_CONFIG_PAGE_QUERY = `
  query SourceCodeVersionConfigPage(
    $sourceCodeVersionId: UUID!
    $templateId: UUID!
    $refsFilter: JSON
    $refsSort: [String!]
    $refsRange: [Int!]
  ) {
    sourceCodeVersionConfigs(sourceCodeVersionId: $sourceCodeVersionId) {
      ${SCV_CONFIG_FIELDS}
    }
    validationRulesByTemplate(templateId: $templateId) {
      ${VALIDATION_RULES_BY_VARIABLE_FIELDS}
    }
    predefinedValidationRules {
      ${VALIDATION_RULE_FIELDS}
    }
    templateTree(id: $templateId, direction: "parents") {
      ${TEMPLATE_TREE_FIELDS}
    }
    sourceCodeVersionTemplateReferences(templateId: $templateId) {
      ${SCV_TEMPLATE_REFERENCE_FIELDS}
    }
    sourceCodeVersions(filter: $refsFilter, sort: $refsSort, range: $refsRange) {
      ${SCV_REFERENCE_LIST_FIELDS}
    }
  }
`;
