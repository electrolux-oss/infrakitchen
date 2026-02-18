import {
  formatNumericDisplayValue,
  parseNumericField,
} from "../../source_code_versions/utils/numeric";
import { getValidationSummary } from "../../source_code_versions/utils/validationSummary";
import { ValidationRule, ValidationRulesByVariable } from "../../types";
import { ResourceVariableSchema } from "../types";

const pickPreferredRule = (rules: ValidationRule[]): ValidationRule | null => {
  if (!rules || rules.length === 0) {
    return null;
  }

  const preferred =
    rules.find((rule) => {
      const hasRegex = Boolean(rule.regex_pattern?.trim().length);
      const hasMin = rule.min_value !== undefined && rule.min_value !== null;
      const hasMax = rule.max_value !== undefined && rule.max_value !== null;
      return hasRegex || hasMin || hasMax;
    }) || rules[0];

  return preferred;
};

export const buildValidationRuleMaps = (
  rulesByVariable: ValidationRulesByVariable[],
): {
  summaryByVariable: Record<string, string>;
  ruleByVariable: Record<string, ValidationRule | null>;
} => {
  const summaryByVariable: Record<string, string> = {};
  const ruleByVariable: Record<string, ValidationRule | null> = {};

  rulesByVariable.forEach(({ variable_name, rules }) => {
    const rule = pickPreferredRule(rules);
    if (!rule) {
      return;
    }

    ruleByVariable[variable_name] = rule;

    const summary = getValidationSummary({
      validation_regex: rule.regex_pattern ?? "",
      validation_min_value: rule.min_value ?? null,
      validation_max_value: rule.max_value ?? null,
    });

    if (summary) {
      summaryByVariable[variable_name] = summary;
    }
  });

  return {
    summaryByVariable,
    ruleByVariable,
  };
};

export const validateResourceVariableValue = (
  value: unknown,
  variable: ResourceVariableSchema,
  validationRule?: ValidationRule | null,
): true | string => {
  const isEmpty = value === null || value === undefined || value === "";

  if (variable.required && isEmpty) {
    return "This field is required";
  }

  if (isEmpty || !validationRule) {
    return true;
  }

  if (variable.type === "string") {
    const regexPattern = validationRule.regex_pattern?.trim();
    if (!regexPattern) {
      return true;
    }

    try {
      const regex = new RegExp(regexPattern);
      if (!regex.test(String(value))) {
        return "Value does not match the required format";
      }
    } catch {
      return true;
    }

    return true;
  }

  if (variable.type === "number") {
    const parsedValue = parseNumericField(value);
    if (parsedValue === null) {
      return "Value must be a valid number";
    }

    const minValue = parseNumericField(validationRule.min_value ?? null);
    const maxValue = parseNumericField(validationRule.max_value ?? null);

    if (minValue !== null && parsedValue < minValue) {
      return `Value must be greater than or equal to ${formatNumericDisplayValue(minValue)}`;
    }

    if (maxValue !== null && parsedValue > maxValue) {
      return `Value must be less than or equal to ${formatNumericDisplayValue(maxValue)}`;
    }
  }

  return true;
};
