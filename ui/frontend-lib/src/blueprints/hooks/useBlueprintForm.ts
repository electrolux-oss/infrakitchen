import { useCallback, useEffect, useMemo, useState } from "react";

import { useConfig } from "../../common";
import { WiringRule } from "../../common/components/viewers/Wiring/types";
import { TemplatePorts } from "../../common/components/viewers/Wiring/WiringCanvas.types";
import { TemplateResponse, TemplateShort } from "../../templates/types";
import { IkEntity } from "../../types";
import { ConstantBlock, ConstantType, ExternalTemplate } from "../types";

export interface MissingParentInfo {
  parentId: string;
  parentName: string;
  abstract: boolean;
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
  template: TemplateResponse;
  configs: SourceConfigItem[];
  outputs: Array<{ name: string }>;
  references: SourceConfigTemplateReferenceItem[];
}

interface BatchTemplatePortsResponse {
  templates: BatchTemplatePortsItem[];
}

interface UseBlueprintFormOptions {
  setValue: (name: string, value: any) => void;
  watch: (name: string) => any;
}

export function useBlueprintForm({ setValue, watch }: UseBlueprintFormOptions) {
  const { ikApi } = useConfig();
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

  // Read current wiring from form - note: intentionally not memoised so that
  // it is always fresh when passed out via the return value.  Callbacks that
  // need the value read it via `watch("wiring")` internally to avoid stale
  // closures.
  const currentWiring: WiringRule[] = watch("wiring") || [];

  const buildExtraSourceIds = useCallback(
    (templates: ExternalTemplate[]) => new Set(templates.map((t) => t.id)),
    [],
  );

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
        for (const item of resp.templates) {
          newPorts[item.template.id] = {
            inputs: item.configs.map((c) => c.name),
            outputs: item.outputs.map((o) => o.name),
          };
        }
        setTemplatePorts((prev) => ({ ...prev, ...newPorts }));

        // Update parents
        const newParents: Record<string, TemplateShort[]> = {};
        for (const item of resp.templates) {
          newParents[item.template.id] = item.template.parents || [];
        }
        setTemplateParents((prev) => ({ ...prev, ...newParents }));

        // Auto-wire from references (unless skipAutoWire)
        if (!opts?.skipAutoWire) {
          const selectedIds = new Set(templateIds);
          const validSourceIds = new Set([
            ...selectedIds,
            ...(opts?.extraSourceIds || []),
          ]);

          const unique: WiringRule[] = [];
          const uniqueKeys = new Set<string>();
          for (const item of resp.templates) {
            for (const ref of item.references) {
              if (
                !validSourceIds.has(ref.reference_template_id) ||
                !selectedIds.has(ref.template_id)
              ) {
                continue;
              }

              const key = `${ref.reference_template_id}|${ref.output_config_name}|${ref.template_id}|${ref.input_config_name}`;
              if (uniqueKeys.has(key)) {
                continue;
              }
              uniqueKeys.add(key);

              unique.push({
                source_template_id: ref.reference_template_id,
                source_output: ref.output_config_name,
                target_template_id: ref.template_id,
                target_variable: ref.input_config_name,
              });
            }
          }

          if (unique.length > 0) {
            const existing: WiringRule[] = watch("wiring") || [];
            const merged = [...existing];
            const existingKeys = new Set(
              existing.map(
                (w) =>
                  `${w.source_template_id}|${w.source_output}|${w.target_template_id}|${w.target_variable}`,
              ),
            );
            for (const w of unique) {
              const key = `${w.source_template_id}|${w.source_output}|${w.target_template_id}|${w.target_variable}`;
              if (existingKeys.has(key)) {
                continue;
              }
              existingKeys.add(key);
              merged.push(w);
            }
            setValue("wiring", merged);
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
    [ikApi, setValue, watch],
  );

  const refreshAutoWiring = useCallback(
    (
      templates: TemplateShort[],
      externals: ExternalTemplate[],
      clearWhenNotApplicable = false,
    ) => {
      const canFetch =
        templates.length >= 2 ||
        (templates.length === 1 && externals.length > 0);

      if (canFetch) {
        fetchBatchPorts(
          templates.map((t) => t.id),
          { extraSourceIds: buildExtraSourceIds(externals) },
        );
        return;
      }

      if (clearWhenNotApplicable) {
        setValue("wiring", []);
      }
    },
    [buildExtraSourceIds, fetchBatchPorts, setValue],
  );

  // Sync ports & parents when selectedTemplates changes
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
          abstract: p.abstract,
        }));
      }
    }

    return result;
  }, [selectedTemplates, templateParents]);

  const missingParentTemplates: ExternalTemplate[] = useMemo(() => {
    const map = new Map<string, ExternalTemplate>();
    for (const infos of Object.values(missingParents)) {
      for (const info of infos) {
        if (!map.has(info.parentId)) {
          map.set(info.parentId, {
            id: info.parentId,
            name: info.parentName,
            abstract: info.abstract,
          });
        }
      }
    }
    return [...map.values()];
  }, [missingParents]);

  const handleExternalTemplateAdd = useCallback(
    (template: ExternalTemplate) => {
      if (externalTemplates.some((t) => t.id === template.id)) return;
      const newExternals = [...externalTemplates, template];
      setExternalTemplates(newExternals);

      refreshAutoWiring(selectedTemplates, newExternals);
    },
    [externalTemplates, selectedTemplates, refreshAutoWiring],
  );

  const handleExternalTemplateRemove = useCallback(
    (templateId: string) => {
      setExternalTemplates((prev) => prev.filter((t) => t.id !== templateId));

      // Remove wiring that references this external template
      const wiring: WiringRule[] = watch("wiring") || [];
      const newWiring = wiring.filter(
        (w) => w.source_template_id !== templateId,
      );
      setValue("wiring", newWiring);
    },
    [watch, setValue],
  );

  const handleConstantAdd = useCallback(
    (type: ConstantType) => {
      const id = crypto.randomUUID();
      const name = `constant_${constants.length + 1}`;
      setConstants((prev) => [...prev, { id, name, type }]);
    },
    [constants.length],
  );

  const handleConstantRemove = useCallback(
    (constantId: string) => {
      setConstants((prev) => prev.filter((c) => c.id !== constantId));

      // Remove wiring that references this constant
      const wiring: WiringRule[] = watch("wiring") || [];
      const newWiring = wiring.filter(
        (w) => w.source_template_id !== constantId,
      );
      setValue("wiring", newWiring);
    },
    [watch, setValue],
  );

  const handleConstantUpdate = useCallback(
    (constantId: string, name: string) => {
      setConstants((prev) =>
        prev.map((c) => (c.id === constantId ? { ...c, name } : c)),
      );
    },
    [],
  );

  const handleConstantDefaultValueUpdate = useCallback(
    (constantId: string, defaultValue: string) => {
      setConstants((prev) =>
        prev.map((c) => (c.id === constantId ? { ...c, defaultValue } : c)),
      );
    },
    [],
  );

  const handleTemplateIdsChange = useCallback(
    (ids: string[]) => {
      const templateEntities = (buffer["templates"] as IkEntity[]) || [];
      const selectedById = new Map(selectedTemplates.map((t) => [t.id, t]));
      const entityById = new Map(templateEntities.map((t) => [t.id, t]));

      const selected: TemplateShort[] = [];
      for (const id of ids) {
        const candidate = selectedById.get(id) || entityById.get(id);
        if (candidate) {
          selected.push(candidate as TemplateShort);
        }
      }

      setSelectedTemplates(selected);

      refreshAutoWiring(selected, externalTemplates, true);

      return ids;
    },
    [buffer, selectedTemplates, refreshAutoWiring, externalTemplates],
  );

  // Sort by parent->child hierarchy (topological sort)
  const sortByHierarchy = useCallback(() => {
    const ids = selectedTemplates.map((t) => t.id);
    const idSet = new Set(ids);
    const templateMap = new Map(selectedTemplates.map((t) => [t.id, t]));

    // Build adjacency: parent -> children (within selected set)
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

    const isSameOrder =
      sorted.length === selectedTemplates.length &&
      sorted.every((t, index) => t.id === selectedTemplates[index].id);

    if (!isSameOrder) {
      setSelectedTemplates(sorted);
      setValue(
        "template_ids",
        sorted.map((t) => t.id),
      );
    }
  }, [selectedTemplates, templateParents, setValue]);

  // Auto-sort by hierarchy when parent info arrives
  useEffect(() => {
    if (selectedTemplates.length >= 2) {
      sortByHierarchy();
    }
    // Only re-run when templateParents changes (new parent info loaded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateParents]);

  // Add a single template (from canvas sidebar / drop)
  const handleTemplateAdd = useCallback(
    (template: TemplateShort) => {
      if (selectedTemplates.some((t) => t.id === template.id)) return;

      const newSelected = [...selectedTemplates, template];
      setSelectedTemplates(newSelected);
      setValue(
        "template_ids",
        newSelected.map((t) => t.id),
      );

      refreshAutoWiring(newSelected, externalTemplates);
    },
    [selectedTemplates, setValue, externalTemplates, refreshAutoWiring],
  );

  const handleTemplateRemove = useCallback(
    (templateId: string) => {
      const currentIds: string[] = watch("template_ids") || [];
      const newIds = currentIds.filter((id) => id !== templateId);
      setValue("template_ids", newIds);

      const wiring: WiringRule[] = watch("wiring") || [];
      const newWiring = wiring.filter(
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
    [watch, setValue],
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
    handleConstantDefaultValueUpdate,
  };
}
