import { SourceConfigResponse } from "../types";

import { formatNumericDisplayValue } from "./numeric";

export function getValidationSummary(
  variable: Partial<
    Pick<
      SourceConfigResponse,
      "validationRegex" | "validationMinValue" | "validationMaxValue"
    >
  >,
) {
  const regex =
    typeof variable.validationRegex === "string"
      ? variable.validationRegex.trim()
      : "";
  if (regex) {
    const truncatedRegex =
      regex.length > 40 ? `${regex.slice(0, 37)}...` : regex;
    return `regex ${truncatedRegex}`;
  }

  const hasMin =
    variable.validationMinValue !== null &&
    variable.validationMinValue !== undefined &&
    variable.validationMinValue !== "";
  const hasMax =
    variable.validationMaxValue !== null &&
    variable.validationMaxValue !== undefined &&
    variable.validationMaxValue !== "";

  if (!hasMin && !hasMax) {
    return null;
  }

  const formattedMin = hasMin
    ? formatNumericDisplayValue(variable.validationMinValue)
    : "";
  const formattedMax = hasMax
    ? formatNumericDisplayValue(variable.validationMaxValue)
    : "";

  if (hasMin && hasMax) {
    return `range ${formattedMin} - ${formattedMax}`;
  }

  if (hasMin) {
    return `min ≥ ${formattedMin}`;
  }

  return `max ≤ ${formattedMax}`;
}
