import { useCallback, useEffect, useMemo } from "react";
import type { DragEvent } from "react";

import { useTheme } from "@mui/material";
import { Connection, Edge, useStoreApi } from "@xyflow/react";

import { GenericTemplate, WiringRule } from "./types";
import {
  buildEdges,
  buildNodes,
  type WiringCanvasStore,
} from "./useWiringCanvasStore";
import {
  TemplatePorts,
  WiringCanvasConstantBlock,
  WiringCanvasExternalTemplate,
} from "./WiringCanvas.types";
import { DRAG_TYPE, DRAG_TYPE_EXTERNAL } from "./WiringCanvasSidebar";

interface UseWiringCanvasGraphParams {
  selectedTemplates: GenericTemplate[];
  wiring: WiringRule[];
  onWiringChange: (wiring: WiringRule[]) => void;
  templatePorts: Record<string, TemplatePorts>;
  onTemplateAdd: (template: GenericTemplate) => void;
  onTemplateRemove: (templateId: string) => void;
  externalTemplates: WiringCanvasExternalTemplate[];
  onExternalTemplateAdd: (template: WiringCanvasExternalTemplate) => void;
  onExternalTemplateRemove: (templateId: string) => void;
  constants: WiringCanvasConstantBlock[];
  onConstantRemove: (constantId: string) => void;
  onConstantUpdate: (constantId: string, name: string) => void;
  onConstantDefaultValueUpdate: (
    constantId: string,
    defaultValue: string,
  ) => void;
}

export function useWiringCanvasGraph(
  params: UseWiringCanvasGraphParams,
  useStore: WiringCanvasStore,
) {
  const {
    selectedTemplates,
    wiring,
    onWiringChange,
    templatePorts,
    onTemplateAdd,
    onTemplateRemove,
    externalTemplates,
    onExternalTemplateAdd,
    onExternalTemplateRemove,
    constants,
    onConstantRemove,
    onConstantUpdate,
    onConstantDefaultValueUpdate,
  } = params;

  const theme = useTheme();
  const rfStore = useStoreApi();

  const selectedIds = useMemo(
    () => new Set(selectedTemplates.map((t) => t.id)),
    [selectedTemplates],
  );

  const externalTemplateIds = useMemo(
    () => new Set(externalTemplates.map((t) => t.id)),
    [externalTemplates],
  );

  // Sync nodes and edges into store atomically when props change
  useEffect(() => {
    const { nodes: currentNodes, dropPositions } = useStore.getState();
    // Merge persisted node positions with any pending drop positions
    const positions: Record<string, { x: number; y: number }> = {
      ...dropPositions,
    };
    for (const node of currentNodes) {
      if (node.position) {
        positions[node.id] = node.position;
      }
    }

    const nextNodes = buildNodes({
      selectedTemplates,
      templatePorts,
      externalTemplates,
      constants,
      positions,
      onTemplateRemove,
      onExternalTemplateRemove,
      onConstantRemove,
      onConstantUpdate,
      onConstantDefaultValueUpdate,
    });

    const nextEdges = buildEdges({
      wiring,
      selectedTemplates,
      externalTemplates,
      constants,
      theme,
    });

    useStore.setState({ nodes: nextNodes, edges: nextEdges });
  }, [
    selectedTemplates,
    templatePorts,
    externalTemplates,
    constants,
    onTemplateRemove,
    onExternalTemplateRemove,
    onConstantRemove,
    onConstantUpdate,
    onConstantDefaultValueUpdate,
    wiring,
    theme,
    useStore,
  ]);

  // Wiring-level callbacks
  const onConnect = useCallback(
    (conn: Connection) => {
      if (
        !conn.source ||
        !conn.target ||
        !conn.sourceHandle ||
        !conn.targetHandle
      ) {
        return;
      }

      const sourceId = conn.source.startsWith("ext-")
        ? conn.source.slice(4)
        : conn.source.startsWith("const-")
          ? conn.source.slice(6)
          : conn.source;

      const sourceOutput = conn.sourceHandle.replace("output-", "");

      const targetVariable = conn.targetHandle.replace("input-", "");

      const exists = wiring.some(
        (w) =>
          w.source_template_id === sourceId &&
          w.source_output === sourceOutput &&
          w.target_template_id === conn.target &&
          w.target_variable === targetVariable,
      );
      if (exists) return;

      onWiringChange([
        ...wiring,
        {
          source_template_id: sourceId,
          source_output: sourceOutput,
          target_template_id: conn.target,
          target_variable: targetVariable,
        },
      ]);
    },
    [wiring, onWiringChange],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      const ids = new Set(deleted.map((e) => e.id));
      onWiringChange(wiring.filter((_w, i) => !ids.has(`wire-${i}`)));
    },
    [wiring, onWiringChange],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    if (
      e.dataTransfer.types.includes(DRAG_TYPE) ||
      e.dataTransfer.types.includes(DRAG_TYPE_EXTERNAL)
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      const rawTemplate = e.dataTransfer.getData(DRAG_TYPE);
      if (rawTemplate) {
        e.preventDefault();
        const template = JSON.parse(rawTemplate) as GenericTemplate;
        if (selectedIds.has(template.id)) return;

        const { transform } = rfStore.getState();
        const position = {
          x: (e.clientX - transform[0]) / transform[2],
          y: (e.clientY - transform[1]) / transform[2],
        };
        useStore.getState().setDropPosition(template.id, position);
        onTemplateAdd(template);
        return;
      }

      const rawExternal = e.dataTransfer.getData(DRAG_TYPE_EXTERNAL);
      if (rawExternal) {
        e.preventDefault();
        const extTemplate = JSON.parse(
          rawExternal,
        ) as WiringCanvasExternalTemplate;
        if (externalTemplateIds.has(extTemplate.id)) return;

        const { transform } = rfStore.getState();
        const position = {
          x: (e.clientX - transform[0]) / transform[2],
          y: (e.clientY - transform[1]) / transform[2],
        };
        useStore.getState().setDropPosition(`ext-${extTemplate.id}`, position);
        onExternalTemplateAdd(extTemplate);
      }
    },
    [
      rfStore,
      onTemplateAdd,
      selectedIds,
      onExternalTemplateAdd,
      externalTemplateIds,
      useStore,
    ],
  );

  return {
    onConnect,
    onEdgesDelete,
    handleDragOver,
    handleDrop,
    selectedIds,
    externalTemplateIds,
  };
}
