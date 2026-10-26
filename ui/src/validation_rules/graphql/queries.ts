import { VALIDATION_RULES_BY_VARIABLE_FIELDS } from "./fragments";

export const VALIDATION_RULES_BY_TEMPLATE_QUERY = `
  query ValidationRulesByTemplate($templateId: UUID!, $variableName: String) {
    validationRulesByTemplate(templateId: $templateId, variableName: $variableName) {
      ${VALIDATION_RULES_BY_VARIABLE_FIELDS}
    }
  }
`;
