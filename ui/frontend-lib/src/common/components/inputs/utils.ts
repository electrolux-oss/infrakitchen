import { IkEntity } from "../../../types";

export const getNestedValue = (obj: any, path: string): string => {
  // Split the path by dot notation (e.g., 'config.details.name' -> ['config', 'details', 'name'])
  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return "";
    }
  }
  return String(current ?? "");
};

export const getOptionLabel = (
  option: IkEntity,
  showFields: string[],
): string => {
  const labels = showFields.map((field: string) =>
    getNestedValue(option, field),
  );

  const primaryLabel =
    labels.filter((label) => label !== "").join(" | ") ||
    option.name ||
    option.identifier ||
    "";

  return primaryLabel;
};
