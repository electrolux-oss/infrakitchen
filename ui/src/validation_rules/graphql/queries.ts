import {
  VALIDATION_RULE_FIELDS,
  VALIDATION_RULES_BY_VARIABLE_FIELDS,
} from "./fragments";

export const PREDEFINED_VALIDATION_RULES_QUERY = `
  query PredefinedValidationRules {
    predefinedValidationRules {
      ${VALIDATION_RULE_FIELDS}
    }
  }
`;

export const VALIDATION_RULES_BY_TEMPLATE_QUERY = `
  query ValidationRulesByTemplate($templateId: UUID!, $variableName: String) {
    validationRulesByTemplate(templateId: $templateId, variableName: $variableName) {
      ${VALIDATION_RULES_BY_VARIABLE_FIELDS}
    }
  }
`;
