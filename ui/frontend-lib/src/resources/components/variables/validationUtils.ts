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
  const validation = variable.validation;
  if (!validation) {
    return labels;
  }

  if (variable.type === "number") {
    const hasMin =
      validation.min_value !== null && validation.min_value !== undefined;
    const hasMax =
      validation.max_value !== null && validation.max_value !== undefined;

    const minLabel = formatValidationNumber(validation.min_value);
    const maxLabel = formatValidationNumber(validation.max_value);

    if (hasMin && hasMax) {
      labels.push(`Allowed: ${minLabel}-${maxLabel}`);
    } else if (hasMin) {
      labels.push(`Min: ${minLabel}`);
    } else if (hasMax) {
      labels.push(`Max: ${maxLabel}`);
    }
  }

  if (variable.type === "string" && validation.regex) {
    labels.push(`Pattern: ${validation.regex}`);
  }

  return labels;
};

export const createVariableValidator = (variable: ResourceVariableSchema) => {
  return (value: unknown): true | string => {
    const empty = isEmptyValue(value);
    if (variable.required && empty) {
      return "This field is required";
    }

    const validation = variable.validation;
    if (!validation || empty) {
      return true;
    }

    if (variable.type === "number") {
      const numericValue = toNumericValue(value);
      if (numericValue === undefined) {
        return "Enter a valid number";
      }

      const min = toNumericValue(validation.min_value);
      if (min !== undefined && numericValue < min) {
        return `Value must be ≥ ${formatValidationNumber(validation.min_value)}`;
      }

      const max = toNumericValue(validation.max_value);
      if (max !== undefined && numericValue > max) {
        return `Value must be ≤ ${formatValidationNumber(validation.max_value)}`;
      }
    }

    if (variable.type === "string") {
      const pattern = validation.regex?.trim();
      if (!pattern) {
        return true;
      }

      const stringValue =
        typeof value === "string"
          ? value
          : value === undefined || value === null
            ? ""
            : String(value);
      if (stringValue.length === 0) {
        return true;
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

    return true;
  };
};
