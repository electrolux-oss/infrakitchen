export const VALIDATION_RULE_FIELDS = `
  id
  targetType
  description
  minValue
  maxValue
  regexPattern
  maxLength
`;

export const VALIDATION_RULES_BY_VARIABLE_FIELDS = `
  variableName
  rules {
    ${VALIDATION_RULE_FIELDS}
  }
`;
