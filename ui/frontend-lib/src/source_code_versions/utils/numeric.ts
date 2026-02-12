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
