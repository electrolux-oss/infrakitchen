import { useCallback, useEffect, useRef, useState } from "react";

import { useConfig } from "../../common/context/ConfigContext";
import { WorkflowStepResponse } from "../types";

/** Minimal metadata for display purposes */
export interface EntityMeta {
  id: string;
  name: string;
  status?: string;
  _entity_name?: string;
}

interface WorkflowMetadata {
  resources: Map<string, EntityMeta>;
  integrations: Map<string, EntityMeta>;
  sourceCodeVersions: Map<string, EntityMeta>;
  loading: boolean;
}

/**
 * Batch-fetches entity metadata (resources, integrations, source code versions)
 * referenced by workflow steps. Uses a single getList call per entity type
 * with `filter: { id: [...] }` to avoid N+1 queries.
 *
 * Results are cached — re-fetches only when the set of referenced IDs changes.
 */
export function useWorkflowMetadata(
  steps: WorkflowStepResponse[],
): WorkflowMetadata {
  const { ikApi } = useConfig();

  const [resources, setResources] = useState<Map<string, EntityMeta>>(
    new Map(),
  );
  const [integrations, setIntegrations] = useState<Map<string, EntityMeta>>(
    new Map(),
  );
  const [sourceCodeVersions, setSourceCodeVersions] = useState<
    Map<string, EntityMeta>
  >(new Map());
  const [loading, setLoading] = useState(false);

  // Track previously fetched ID sets to avoid redundant calls
  const fetchedRef = useRef<{
    resourceIds: string;
    integrationIds: string;
    scvIds: string;
  }>({ resourceIds: "", integrationIds: "", scvIds: "" });

  const fetchMetadata = useCallback(async () => {
    // Collect unique IDs from all steps
    const resourceIds = new Set<string>();
    const integrationIds = new Set<string>();
    const scvIds = new Set<string>();

    for (const step of steps) {
      if (step.resource_id) resourceIds.add(step.resource_id);
      if (step.parent_resource_ids) {
        for (const id of step.parent_resource_ids) resourceIds.add(id);
      }

      for (const id of step.integration_ids) integrationIds.add(id);
      if (step.source_code_version_id) scvIds.add(step.source_code_version_id);
    }

    const resourceKey = [...resourceIds].sort().join(",");
    const integrationKey = [...integrationIds].sort().join(",");
    const scvKey = [...scvIds].sort().join(",");

    // Skip if nothing changed
    if (
      resourceKey === fetchedRef.current.resourceIds &&
      integrationKey === fetchedRef.current.integrationIds &&
      scvKey === fetchedRef.current.scvIds
    ) {
      return;
    }

    fetchedRef.current = {
      resourceIds: resourceKey,
      integrationIds: integrationKey,
      scvIds: scvKey,
    };

    setLoading(true);

    const fetches: Promise<void>[] = [];

    // Fetch resources
    if (resourceIds.size > 0) {
      fetches.push(
        ikApi
          .getList("resources", {
            filter: { id: [...resourceIds] },
            pagination: { page: 1, perPage: resourceIds.size },
          })
          .then(({ data }) => {
            const map = new Map<string, EntityMeta>();
            for (const r of data) {
              map.set(r.id, {
                id: r.id,
                name: r.name,
                status: r.status,
                _entity_name: "resource",
              });
            }
            setResources(map);
          })
          .catch(() => {}),
      );
    }

    // Fetch integrations
    if (integrationIds.size > 0) {
      fetches.push(
        ikApi
          .getList("integrations", {
            filter: { id: [...integrationIds] },
            pagination: { page: 1, perPage: integrationIds.size },
          })
          .then(({ data }) => {
            const map = new Map<string, EntityMeta>();
            for (const r of data) {
              map.set(r.id, {
                id: r.id,
                name: r.name,
                _entity_name: "integration",
              });
            }
            setIntegrations(map);
          })
          .catch(() => {}),
      );
    }

    // Fetch source code versions
    if (scvIds.size > 0) {
      fetches.push(
        ikApi
          .getList("source_code_versions", {
            filter: { id: [...scvIds] },
            pagination: { page: 1, perPage: scvIds.size },
          })
          .then(({ data }) => {
            const map = new Map<string, EntityMeta>();
            for (const r of data) {
              map.set(r.id, {
                id: r.id,
                name:
                  r.source_code_version ||
                  r.source_code_branch ||
                  r.id.slice(0, 8),
                _entity_name: "source_code_version",
              });
            }
            setSourceCodeVersions(map);
          })
          .catch(() => {}),
      );
    }

    await Promise.all(fetches);
    setLoading(false);
  }, [steps, ikApi]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return { resources, integrations, sourceCodeVersions, loading };
}
