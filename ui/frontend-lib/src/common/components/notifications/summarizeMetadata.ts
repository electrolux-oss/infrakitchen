/**
 * Best-effort extraction of a short, human-readable message from a
 * structured error metadata payload (e.g. a raw API error body), so the
 * card can show a clean one-liner instead of always dumping full JSON.
 */
export interface MetadataSummary {
  text?: string;
  raw?: string;
}

const PRIMARY_TEXT_KEYS = ["message", "cloud_message", "error"];

const extractPrimaryText = (item: unknown): string | undefined => {
  if (!item || typeof item !== "object") return undefined;
  for (const key of PRIMARY_TEXT_KEYS) {
    const value = (item as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
};

export const summarizeMetadata = (metadata: unknown): MetadataSummary => {
  if (!metadata || (Array.isArray(metadata) && metadata.length === 0)) {
    return {};
  }

  const items = Array.isArray(metadata) ? metadata : [metadata];
  const first = items[0];
  const text = extractPrimaryText(first);

  const raw = JSON.stringify(metadata, null, 2);
  const extraKeys =
    items.length > 1 ||
    (first &&
      typeof first === "object" &&
      Object.keys(first).some((key) => !PRIMARY_TEXT_KEYS.includes(key)));

  return {
    text: text ?? raw,
    raw: text && extraKeys ? raw : undefined,
  };
};
