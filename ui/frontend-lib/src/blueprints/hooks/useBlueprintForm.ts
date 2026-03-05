import { useCallback, useEffect, useMemo, useState } from "react";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";
import { TemplateShort } from "../../templates/types";
import { IkEntity } from "../../types";
import {
  TemplatePorts,
  ExternalTemplate,
  ConstantBlock,
} from "../components/WiringCanvas";
import { WiringRule } from "../types";

export interface MissingParentInfo {
  parentId: string;
  parentName: string;
}

interface SourceConfigItem {
  name: string;
}

interface SourceConfigTemplateReferenceItem {
  reference_template_id: string;
  template_id: string;
  input_config_name: string;
  output_config_name: string;
}

interface BatchTemplatePortsItem {
  configs: SourceConfigItem[];
  outputs: Array<{ name: string }>;
  references: SourceConfigTemplateReferenceItem[];
  parents: TemplateShort[];
}

interface BatchTemplatePortsResponse {
  templates: Record<string, BatchTemplatePortsItem>;
}

interface UseBlueprintFormOptions {
  ikApi: InfraKitchenApi;
  setValue: (name: string, value: any) => void;
  watch: (name: string) => any;
}

export function useBlueprintForm({
  ikApi,
  setValue,
  watch,
}: UseBlueprintFormOptions) {
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );
  const [selectedTemplates, setSelectedTemplates] = useState<TemplateShort[]>(
    [],
  );
  const [templatePorts, setTemplatePorts] = useState<
    Record<string, TemplatePorts>
  >({});

  // Parent info per template (fetched from full template details)
  const [templateParents, setTemplateParents] = useState<
    Record<string, TemplateShort[]>
  >({});

  // External (input) templates pinned as parents on the canvas
  const [externalTemplates, setExternalTemplates] = useState<
    ExternalTemplate[]
  >([]);

  // Constant blocks pinned on the canvas
  const [constants, setConstants] = useState<ConstantBlock[]>([]);

  const currentWiring: WiringRule[] = watch("wiring") || [];

  // ── Batch fetch ports, parents, and references for multiple templates ──
  const fetchBatchPorts = useCallback(
    async (
      templateIds: string[],
      opts?: {
        /** Extra template IDs that are valid wiring sources (external templates) */
        extraSourceIds?: Set<string>;
        /** If true, skip auto-wiring (edit page restores wiring from saved data) */
        skipAutoWire?: boolean;
      },
    ) => {
      if (templateIds.length === 0) return;

      // Include external template IDs in the batch so we also fetch their ports
      const allIds = [
        ...new Set([...templateIds, ...(opts?.extraSourceIds || [])]),
      ];

      try {
        const resp = (await ikApi.postRaw(
          "source_code_versions/templates/ports",
          { template_ids: allIds },
        )) as BatchTemplatePortsResponse;

        // Update ports
        const newPorts: Record<string, TemplatePorts> = {};
        for (const [tid, item] of Object.entries(resp.templates)) {
          newPorts[tid] = {
            inputs: item.configs.map((c) => c.name),
            outputs: item.outputs.map((o) => o.name),
          };
        }
        setTemplatePorts((prev) => ({ ...prev, ...newPorts }));

        // Update parents
        const newParents: Record<string, TemplateShort[]> = {};
        for (const [tid, item] of Object.entries(resp.templates)) {
          newParents[tid] = item.parents || [];
        }
        setTemplateParents((prev) => ({ ...prev, ...newParents }));

        // Auto-wire from references (unless skipAutoWire)
        if (!opts?.skipAutoWire) {
          const selectedIds = new Set(templateIds);
          const validSourceIds = new Set([
            ...selectedIds,
            ...(opts?.extraSourceIds || []),
          ]);

          const allRefs: SourceConfigTemplateReferenceItem[] = [];
          for (const [, item] of Object.entries(resp.templates)) {
            allRefs.push(...item.references);
          }

          const autoWires: WiringRule[] = allRefs
            .filter(
              (ref) =>
                validSourceIds.has(ref.reference_template_id) &&
                selectedIds.has(ref.template_id),
            )
            .map((ref) => ({
              source_template_id: ref.reference_template_id,
              source_output: ref.output_config_name,
              target_template_id: ref.template_id,
              target_variable: ref.input_config_name,
            }));

          const unique = autoWires.filter(
            (w, i, arr) =>
              arr.findIndex(
                (o) =>
                  o.source_template_id === w.source_template_id &&
                  o.source_output === w.source_output &&
                  o.target_template_id === w.target_template_id &&
                  o.target_variable === w.target_variable,
              ) === i,
          );

          if (unique.length > 0) {
            setValue("wiring", unique);
          }
        }
      } catch {
        // Fallback: set empty ports for all requested IDs
        const emptyPorts: Record<string, TemplatePorts> = {};
        for (const tid of allIds) {
          emptyPorts[tid] = { inputs: [], outputs: [] };
        }
        setTemplatePorts((prev) => ({ ...prev, ...emptyPorts }));
      }
    },
    [ikApi, setValue],
  );

  // ── Single-template port fetch (kept for incremental adds) ───────────
  const fetchPortsForTemplate = useCallback(
    async (templateId: string) => {
      try {
        const resp = (await ikApi.postRaw(
          "source_code_versions/templates/ports",
          { template_ids: [templateId] },
        )) as BatchTemplatePortsResponse;

        const item = resp.templates[templateId];
        if (item) {
          const ports: TemplatePorts = {
            inputs: item.configs.map((c) => c.name),
            outputs: item.outputs.map((o) => o.name),
          };
          setTemplatePorts((prev) => ({ ...prev, [templateId]: ports }));
          setTemplateParents((prev) => ({
            ...prev,
            [templateId]: item.parents || [],
          }));
        }
      } catch {
        setTemplatePorts((prev) => ({
          ...prev,
          [templateId]: { inputs: [], outputs: [] },
        }));
      }
    },
    [ikApi],
  );

  // ── Sync ports & parents when selectedTemplates changes ──────────────
  useEffect(() => {
    const missing = selectedTemplates.filter(
      (t) => !templatePorts[t.id] || !templateParents[t.id],
    );
    if (missing.length > 0) {
      fetchBatchPorts(
        missing.map((t) => t.id),
        { skipAutoWire: true },
      );
    }
  }, [selectedTemplates, templatePorts, templateParents, fetchBatchPorts]);

  // ── Compute missing parents ──────────────────────────────────────────
  const missingParents: Record<string, MissingParentInfo[]> = useMemo(() => {
    const selectedIds = new Set(selectedTemplates.map((t) => t.id));
    const result: Record<string, MissingParentInfo[]> = {};

    for (const t of selectedTemplates) {
      const parents = templateParents[t.id] || [];
      const missing = parents.filter((p) => !selectedIds.has(p.id));
      if (missing.length > 0) {
        result[t.id] = missing.map((p) => ({
          parentId: p.id,
          parentName: p.name,
        }));
      }
    }

    return result;
  }, [selectedTemplates, templateParents]);

  // ── Unique missing parent templates (for sidebar) ────────────────────
  const missingParentTemplates: ExternalTemplate[] = useMemo(() => {
    const map = new Map<string, string>();
    for (const infos of Object.values(missingParents)) {
      for (const info of infos) {
        map.set(info.parentId, info.parentName);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [missingParents]);

  // ── External template handlers ───────────────────────────────────────
  const handleExternalTemplateAdd = useCallback(
    (template: ExternalTemplate) => {
      if (externalTemplates.some((t) => t.id === template.id)) return;
      const newExternals = [...externalTemplates, template];
      setExternalTemplates(newExternals);

      // Fetch ports for this template if not already cached
      if (!templatePorts[template.id]) {
        fetchPortsForTemplate(template.id);
      }

      // Re-run auto-wiring including the new external template as a valid source
      if (selectedTemplates.length > 0) {
        const extIds = new Set(newExternals.map((t) => t.id));
        fetchBatchPorts(
          selectedTemplates.map((t) => t.id),
          { extraSourceIds: extIds },
        );
      }
    },
    [
      externalTemplates,
      templatePorts,
      fetchPortsForTemplate,
      selectedTemplates,
      fetchBatchPorts,
    ],
  );

  const handleExternalTemplateRemove = useCallback(
    (templateId: string) => {
      setExternalTemplates((prev) => prev.filter((t) => t.id !== templateId));

      // Remove wiring that references this external template
      const newWiring = (currentWiring || []).filter(
        (w) => w.source_template_id !== templateId,
      );
      setValue("wiring", newWiring);
    },
    [currentWiring, setValue],
  );

  // ── Constant block handlers ──────────────────────────────────────────
  const handleConstantAdd = useCallback(() => {
    const id = Math.random().toString(36).slice(2, 10);
    const name = `constant_${constants.length + 1}`;
    setConstants((prev) => [...prev, { id, name }]);
  }, [constants.length]);

  const handleConstantRemove = useCallback(
    (constantId: string) => {
      setConstants((prev) => prev.filter((c) => c.id !== constantId));

      // Remove wiring that references this constant
      const newWiring = (currentWiring || []).filter(
        (w) => w.source_template_id !== constantId,
      );
      setValue("wiring", newWiring);
    },
    [currentWiring, setValue],
  );

  const handleConstantUpdate = useCallback(
    (constantId: string, name: string) => {
      setConstants((prev) =>
        prev.map((c) => (c.id === constantId ? { ...c, name } : c)),
      );
    },
    [],
  );

  // ── Template selection change handler ────────────────────────────────
  const handleTemplateIdsChange = useCallback(
    (ids: string[]) => {
      const templateEntities = (buffer["templates"] as IkEntity[]) || [];
      const selected = ids
        .map(
          (id) =>
            selectedTemplates.find((t) => t.id === id) ||
            templateEntities.find((t) => t.id === id),
        )
        .filter(Boolean) as TemplateShort[];
      setSelectedTemplates(selected);

      if (selected.length >= 2) {
        const extIds = new Set(externalTemplates.map((t) => t.id));
        fetchBatchPorts(
          selected.map((t) => t.id),
          { extraSourceIds: extIds },
        );
      } else if (selected.length === 1 && externalTemplates.length > 0) {
        const extIds = new Set(externalTemplates.map((t) => t.id));
        fetchBatchPorts(
          selected.map((t) => t.id),
          { extraSourceIds: extIds },
        );
      } else {
        setValue("wiring", []);
      }

      return ids;
    },
    [buffer, selectedTemplates, fetchBatchPorts, setValue, externalTemplates],
  );

  // ── Sort by parent→child hierarchy (topological sort) ───────────────
  const sortByHierarchy = useCallback(() => {
    const ids = selectedTemplates.map((t) => t.id);
    const idSet = new Set(ids);
    const templateMap = new Map(selectedTemplates.map((t) => [t.id, t]));

    // Build adjacency: parent → children (within selected set)
    const childrenOf = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    for (const id of ids) {
      childrenOf.set(id, new Set());
      inDegree.set(id, 0);
    }

    for (const t of selectedTemplates) {
      const parents = templateParents[t.id] || [];
      for (const p of parents) {
        if (idSet.has(p.id)) {
          childrenOf.get(p.id)!.add(t.id);
          inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
        }
      }
    }

    // Kahn's algorithm
    const queue = ids.filter((id) => (inDegree.get(id) || 0) === 0);
    const sorted: TemplateShort[] = [];

    while (queue.length > 0) {
      const id = queue.shift()!;
      sorted.push(templateMap.get(id)!);
      for (const child of childrenOf.get(id) || []) {
        const deg = (inDegree.get(child) || 1) - 1;
        inDegree.set(child, deg);
        if (deg === 0) queue.push(child);
      }
    }

    // Append any remaining (cycles) in original order
    const sortedIds = new Set(sorted.map((t) => t.id));
    for (const t of selectedTemplates) {
      if (!sortedIds.has(t.id)) sorted.push(t);
    }

    setSelectedTemplates(sorted);
    setValue(
      "template_ids",
      sorted.map((t) => t.id),
    );
  }, [selectedTemplates, templateParents, setValue]);

  // ── Auto-sort by hierarchy when parent info arrives ───────────────────
  useEffect(() => {
    if (selectedTemplates.length >= 2) {
      sortByHierarchy();
    }
    // Only re-run when templateParents changes (new parent info loaded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateParents]);

  // ── Add a single template (from canvas sidebar / drop) ───────────────
  const handleTemplateAdd = useCallback(
    (template: TemplateShort) => {
      if (selectedTemplates.some((t) => t.id === template.id)) return;

      const newSelected = [...selectedTemplates, template];
      setSelectedTemplates(newSelected);
      setValue(
        "template_ids",
        newSelected.map((t) => t.id),
      );

      if (newSelected.length >= 2) {
        const extIds = new Set(externalTemplates.map((t) => t.id));
        fetchBatchPorts(
          newSelected.map((t) => t.id),
          { extraSourceIds: extIds },
        );
      } else if (newSelected.length === 1 && externalTemplates.length > 0) {
        const extIds = new Set(externalTemplates.map((t) => t.id));
        fetchBatchPorts(
          newSelected.map((t) => t.id),
          { extraSourceIds: extIds },
        );
      }
    },
    [selectedTemplates, setValue, fetchBatchPorts, externalTemplates],
  );

  // ── Remove a template ────────────────────────────────────────────────
  const handleTemplateRemove = useCallback(
    (templateId: string) => {
      const currentIds: string[] = watch("template_ids") || [];
      const newIds = currentIds.filter((id) => id !== templateId);
      setValue("template_ids", newIds);

      const newWiring = (currentWiring || []).filter(
        (w) =>
          w.source_template_id !== templateId &&
          w.target_template_id !== templateId,
      );
      setValue("wiring", newWiring);

      setSelectedTemplates((prev) => prev.filter((t) => t.id !== templateId));

      setTemplatePorts((prev) => {
        const updated = { ...prev };
        delete updated[templateId];
        return updated;
      });
    },
    [watch, setValue, currentWiring],
  );

  return {
    buffer,
    setBuffer,
    selectedTemplates,
    setSelectedTemplates,
    templatePorts,
    currentWiring,
    missingParents,
    missingParentTemplates,
    fetchPortsForTemplate,
    fetchBatchPorts,
    handleTemplateAdd,
    handleTemplateIdsChange,
    handleTemplateRemove,
    externalTemplates,
    setExternalTemplates,
    handleExternalTemplateAdd,
    handleExternalTemplateRemove,
    constants,
    setConstants,
    handleConstantAdd,
    handleConstantRemove,
    handleConstantUpdate,
  };
}
