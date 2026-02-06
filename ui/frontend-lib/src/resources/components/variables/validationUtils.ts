import { ResourceVariableSchema } from "../../types";

export const formatValidationNumber = (
  value: string | number | null | undefined,
): string => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric.toString();
  }
  return `${value}`;
};

const isEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  return false;
};

const toNumericValue = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value !== "") {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? undefined : numeric;
  }
  return undefined;
};

export const buildHintLabels = (variable: ResourceVariableSchema): string[] => {
  const labels: string[] = [];
  const validationRules = Array.isArray(variable.validation)
    ? variable.validation
    : [];

  if (validationRules.length === 0) {
    return labels;
  }

  const addLabel = (label: string) => {
    if (!labels.includes(label)) {
      labels.push(label);
    }
  };

  if (variable.type === "number") {
    validationRules.forEach((rule) => {
      const hasMin = rule.min_value !== null && rule.min_value !== undefined;
      const hasMax = rule.max_value !== null && rule.max_value !== undefined;

      const minLabel = formatValidationNumber(rule.min_value);
      const maxLabel = formatValidationNumber(rule.max_value);

      if (hasMin && hasMax) {
        addLabel(`Allowed: ${minLabel}-${maxLabel}`);
      } else if (hasMin) {
        addLabel(`Min: ${minLabel}`);
      } else if (hasMax) {
        addLabel(`Max: ${maxLabel}`);
      }
    });
  }

  if (variable.type === "string") {
    validationRules.forEach((rule) => {
      if (rule.regex) {
        addLabel(`Pattern: ${rule.regex}`);
      }
      if (rule.max_length !== null && rule.max_length !== undefined) {
        addLabel(`Max length: ${rule.max_length}`);
      }
    });
  }

  return labels;
};

export const createVariableValidator = (variable: ResourceVariableSchema) => {
  return (value: unknown): true | string => {
    const empty = isEmptyValue(value);
    if (variable.required && empty) {
      return "This field is required";
    }

    const validationRules = Array.isArray(variable.validation)
      ? variable.validation
      : [];
    if (validationRules.length === 0 || empty) {
      return true;
    }

    if (variable.type === "number") {
      const numericValue = toNumericValue(value);
      if (numericValue === undefined) {
        return "Enter a valid number";
      }

      for (const rule of validationRules) {
        const min = toNumericValue(rule.min_value);
        if (min !== undefined && numericValue < min) {
          return `Value must be ≥ ${formatValidationNumber(rule.min_value)}`;
        }

        const max = toNumericValue(rule.max_value);
        if (max !== undefined && numericValue > max) {
          return `Value must be ≤ ${formatValidationNumber(rule.max_value)}`;
        }
      }
    }

    if (variable.type === "string") {
      const stringValue =
        typeof value === "string"
          ? value
          : value === undefined || value === null
            ? ""
            : String(value);
      if (stringValue.length === 0) {
        return true;
      }

      for (const rule of validationRules) {
        if (
          rule.max_length !== null &&
          rule.max_length !== undefined &&
          stringValue.length > rule.max_length
        ) {
          return `Value must be ≤ ${rule.max_length} characters`;
        }

        const pattern = rule.regex?.trim();
        if (!pattern) {
          continue;
        }

        try {
          const regex = new RegExp(pattern);
          if (!regex.test(stringValue)) {
            return `Value must match pattern ${pattern}`;
          }
        } catch {
          return true;
        }
      }
    }

    return true;
  };
};
