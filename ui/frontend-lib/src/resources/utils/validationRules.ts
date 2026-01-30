import { ValidationRule } from "../types";

type StringValidator = (value: string | undefined | null) => true | string;

type NumberValidator = (
  value: number | string | undefined | null,
) => true | string;

const regexCache = new Map<string, RegExp | null>();

const getFieldLabel = (rule: ValidationRule): string => {
  const label = rule.rule_metadata?.field;
  if (typeof label === "string" && label.trim().length > 0) {
    return label;
  }
  return rule.field_path;
};

const getMetadataMessage = (
  rule: ValidationRule,
  key: string,
  fallback: string,
): string => {
  const message = rule.rule_metadata?.[key];
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }
  return fallback;
};

const getCachedRegex = (pattern: string): RegExp | null => {
  if (regexCache.has(pattern)) {
    return regexCache.get(pattern) ?? null;
  }
  try {
    const compiled = new RegExp(pattern);
    regexCache.set(pattern, compiled);
    return compiled;
  } catch {
    regexCache.set(pattern, null);
    return null;
  }
};

export const createStringValidator = (
  rule?: ValidationRule,
): StringValidator | undefined => {
  if (!rule || rule.data_type !== "string") {
    return undefined;
  }

  return (value) => {
    if (value === undefined || value === null || value === "") {
      return true;
    }

    const trimmed = value.trim();

    if (rule.regex) {
      const pattern = getCachedRegex(rule.regex);
      if (pattern && !pattern.test(trimmed)) {
        return getMetadataMessage(
          rule,
          "regex",
          `${getFieldLabel(rule)} does not match the required pattern.`,
        );
      }
    }

    if (
      typeof rule.max_length === "number" &&
      trimmed.length > rule.max_length
    ) {
      return getMetadataMessage(
        rule,
        "max_length",
        `${getFieldLabel(rule)} must be ${rule.max_length} characters or fewer.`,
      );
    }

    if (rule.no_whitespace && /\s/.test(trimmed)) {
      return getMetadataMessage(
        rule,
        "no_whitespace",
        `${getFieldLabel(rule)} cannot contain whitespace characters.`,
      );
    }

    return true;
  };
};

export const createNumberValidator = (
  rule?: ValidationRule,
): NumberValidator | undefined => {
  if (!rule || rule.data_type !== "number") {
    return undefined;
  }

  return (value) => {
    if (value === undefined || value === null || value === "") {
      return true;
    }

    let numericValue: number;
    if (typeof value === "number") {
      numericValue = value;
    } else {
      const parsed = Number(String(value).trim());
      if (Number.isNaN(parsed)) {
        return getMetadataMessage(
          rule,
          "numeric",
          `${getFieldLabel(rule)} must be numeric.`,
        );
      }
      numericValue = parsed;
    }

    if (typeof rule.min_value === "number" && numericValue < rule.min_value) {
      return getMetadataMessage(
        rule,
        "min_value",
        `${getFieldLabel(rule)} must be greater than or equal to ${rule.min_value}.`,
      );
    }

    if (typeof rule.max_value === "number" && numericValue > rule.max_value) {
      return getMetadataMessage(
        rule,
        "max_value",
        `${getFieldLabel(rule)} must be less than or equal to ${rule.max_value}.`,
      );
    }

    return true;
  };
};

export const buildStringValidateObject = (options: {
  rule?: ValidationRule;
  requiredMessage?: string;
}): Record<string, StringValidator> => {
  const { rule, requiredMessage } = options;
  const validators: Record<string, StringValidator> = {};

  if (requiredMessage) {
    validators.required = (value) => {
      if (value === undefined || value === null) {
        return requiredMessage;
      }
      if (typeof value === "string" && value.trim().length === 0) {
        return requiredMessage;
      }
      return true;
    };
  }

  const constraintValidator = createStringValidator(rule);
  if (constraintValidator) {
    validators.constraint = constraintValidator;
  }

  return validators;
};

export const hasActiveValidators = (validators: Record<string, unknown>) =>
  Object.keys(validators).length > 0;

export const handleTrimOnBlur = (
  currentValue: unknown,
  onChange: (nextValue: string) => void,
  onBlur?: () => void,
) => {
  if (typeof currentValue === "string") {
    const trimmed = currentValue.trim();
    if (trimmed !== currentValue) {
      onChange(trimmed);
    }
  }

  if (onBlur) {
    onBlur();
  }
};
