import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useConfig } from "../context/ConfigContext";

export interface EntityMeta {
  id: string;
  name: string;
  status?: string;
  _entity_name: string;
}

/**
 * Request format: entity API resource name → list of IDs to fetch.
 * Example: { resources: ["id1", "id2"], integrations: ["id3"] }
 */
export type EntityMetaRequest = Record<string, string[]>;

/**
 * Extracts a display name from an entity record.
 * Override per entity if the name field differs from "name".
 */
const defaultNameExtractor = (record: Record<string, any>): string =>
  record.name ??
  record.source_code_version ??
  record.source_code_branch ??
  record.identifier ??
  record.id?.slice(0, 8);

interface UseEntityMetadataOptions {
  fields?: string[];
}

interface UseEntityMetadataReturn {
  /** Lookup any entity by its ID (across all entity types) */
  data: Map<string, EntityMeta>;
  loading: boolean;
}

/**
 * Generic hook to batch-fetch entity metadata by ID across multiple entity types.
 *
 * Usage:
 * ```ts
 * const { data, loading } = useEntityMetadata({
 *   resources: [step.resource_id],
 *   integrations: step.integration_ids,
 * });
 * const name = data.get(someId)?.name;
 * ```
 *
 * Results are cached — re-fetches only when the set of requested IDs changes.
 */
export function useEntityMetadata(
  requests: EntityMetaRequest,
  options?: UseEntityMetadataOptions,
): UseEntityMetadataReturn {
  const { ikApi } = useConfig();
  const [data, setData] = useState<Map<string, EntityMeta>>(new Map());
  const [loading, setLoading] = useState(false);

  // Cache key to detect changes
  const prevKeyRef = useRef<string>("");

  const fetchAll = useCallback(async () => {
    // Build a stable cache key from all requests
    const keyParts: string[] = [];
    for (const [entity, ids] of Object.entries(requests)) {
      const sorted = [...new Set(ids.filter(Boolean))].sort();
      if (sorted.length > 0) {
        keyParts.push(`${entity}:${sorted.join(",")}`);
      }
    }
    const cacheKey = keyParts.join("|");

    if (!cacheKey || cacheKey === prevKeyRef.current) return;
    prevKeyRef.current = cacheKey;

    setLoading(true);

    const fetches: Promise<void>[] = [];
    const results = new Map<string, EntityMeta>();

    for (const [entity, ids] of Object.entries(requests)) {
      const uniqueIds = [...new Set(ids.filter(Boolean))];
      if (uniqueIds.length === 0) continue;
      const fields = options?.fields ?? ["id", "name", "status", "state"];

      fetches.push(
        ikApi
          .getList(entity, {
            filter: { id: uniqueIds },
            pagination: { page: 1, perPage: uniqueIds.length },
            fields,
          })
          .then(({ data: records }) => {
            for (const r of records) {
              results.set(r.id, {
                id: r.id,
                name: defaultNameExtractor(r),
                status: r.status,
                _entity_name: entity,
              });
            }
          })
          .catch(() => {}),
      );
    }

    await Promise.all(fetches);
    setData(results);
    setLoading(false);
  }, [requests, ikApi, options?.fields]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, loading };
}

interface UseEntityMetadataFromRowsOptions extends UseEntityMetadataOptions {
  /** Row field containing the entity type (default: "model") */
  modelField?: string;
  /** Row field containing the entity id (default: "entity_id") */
  idField?: string;
}

/**
 * Convenience hook that builds an EntityMetaRequest from a list of rows,
 * then delegates to useEntityMetadata.
 *
 * Usage:
 * ```ts
 * const { data } = useEntityMetadataFromRows(rows);
 * ```
 */
export function useEntityMetadataFromRows(
  rows: Array<Record<string, any>>,
  options?: UseEntityMetadataFromRowsOptions,
): UseEntityMetadataReturn {
  const modelField = options?.modelField ?? "model";
  const idField = options?.idField ?? "entity_id";

  const requests = useMemo(() => {
    const byModel: EntityMetaRequest = {};
    for (const row of rows) {
      const model = row[modelField];
      const id = row[idField];
      if (id && model) {
        const apiName = `${model}s`;
        if (!byModel[apiName]) byModel[apiName] = [];
        byModel[apiName].push(id);
      }
    }
    return byModel;
  }, [rows, modelField, idField]);

  return useEntityMetadata(requests, {
    fields: options?.fields ?? ["id", "name", "status", "state"],
  });
}
