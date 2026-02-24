import { SourceConfigResponse } from "../types";

import { formatNumericDisplayValue } from "./numeric";

export function getValidationSummary(
  variable: Partial<
    Pick<
      SourceConfigResponse,
      "validation_regex" | "validation_min_value" | "validation_max_value"
    >
  >,
) {
  const regex =
    typeof variable.validation_regex === "string"
      ? variable.validation_regex.trim()
      : "";
  if (regex) {
    const truncatedRegex =
      regex.length > 40 ? `${regex.slice(0, 37)}...` : regex;
    return `regex ${truncatedRegex}`;
  }

  const hasMin =
    variable.validation_min_value !== null &&
    variable.validation_min_value !== undefined &&
    variable.validation_min_value !== "";
  const hasMax =
    variable.validation_max_value !== null &&
    variable.validation_max_value !== undefined &&
    variable.validation_max_value !== "";

  if (!hasMin && !hasMax) {
    return null;
  }

  const formattedMin = hasMin
    ? formatNumericDisplayValue(variable.validation_min_value)
    : "";
  const formattedMax = hasMax
    ? formatNumericDisplayValue(variable.validation_max_value)
    : "";

  if (hasMin && hasMax) {
    return `range ${formattedMin} - ${formattedMax}`;
  }

  if (hasMin) {
    return `min ≥ ${formattedMin}`;
  }

  return `max ≤ ${formattedMax}`;
}
