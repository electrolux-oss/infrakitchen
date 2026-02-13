export const normalizeNumericField = (
  value: string | number | null | undefined,
): string => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return String(value);
};

export const parseNumericField = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};

export const formatNumericDisplayValue = (
  value: string | number | null | undefined,
): string => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const asString = String(value);
  if (!asString.includes(".")) {
    return asString;
  }

  const trimmed = asString
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.0+$/, "");

  return trimmed;
};
