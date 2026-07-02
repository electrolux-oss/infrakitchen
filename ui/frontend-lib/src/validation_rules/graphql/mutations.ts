export const REPLACE_VALIDATION_RULES_MUTATION = `
  mutation ReplaceValidationRules($templateId: UUID!, $variableName: String!, $rules: [ValidationRuleInput!]!) {
    replaceValidationRules(templateId: $templateId, variableName: $variableName, rules: $rules) {
      id
      templateId
      variableName
      validationRuleId
    }
  }
`;
