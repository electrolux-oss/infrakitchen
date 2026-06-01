import { ValidationRule, ValidationRulesByVariable } from "../../types";

export interface GqlValidationRule {
  id: string | null;
  targetType: string;
  description: string | null;
  minValue: string | null;
  maxValue: string | null;
  regexPattern: string | null;
  maxLength: number | null;
}

export interface GqlValidationRulesByVariable {
  variableName: string;
  rules: GqlValidationRule[];
}

export function transformValidationRule(
  gql: GqlValidationRule,
): ValidationRule {
  return {
    id: gql.id ?? undefined,
    target_type: gql.targetType as ValidationRule["target_type"],
    description: gql.description,
    min_value: gql.minValue,
    max_value: gql.maxValue,
    regex_pattern: gql.regexPattern,
    max_length: gql.maxLength,
  };
}

export function transformValidationRulesByVariable(
  gql: GqlValidationRulesByVariable,
): ValidationRulesByVariable {
  return {
    variable_name: gql.variableName,
    rules: gql.rules.map(transformValidationRule),
  };
}
