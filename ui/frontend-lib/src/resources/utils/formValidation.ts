export const getFirstErrorFieldPath = (
  errorObject: Record<string, any>,
  parentPath = "",
): string | null => {
  for (const key of Object.keys(errorObject || {})) {
    const value = errorObject[key];
    const path = parentPath ? `${parentPath}.${key}` : key;

    if (value?.type || value?.message || value?.ref) {
      return path;
    }

    if (value && typeof value === "object") {
      const nestedPath = getFirstErrorFieldPath(value, path);
      if (nestedPath) {
        return nestedPath;
      }
    }
  }

  return null;
};

export const validateTagEntries = (
  entries: Array<{ name?: string; value?: string }> = [],
) => {
  const hasIncompleteEntries = entries.some(
    (entry) => !entry?.name?.trim() || !entry?.value?.trim(),
  );

  return !hasIncompleteEntries;
};
