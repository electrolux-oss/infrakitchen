import { useCallback, useEffect, useMemo, useRef } from "react";
import type { DragEvent } from "react";

import { Connection, Edge, useReactFlow } from "@xyflow/react";

import { randomUUID } from "../../../../utils/uuid";

import { parseSourceHandle, parseTargetHandle } from "./helpers";
import { computeDiagramLayout } from "./layout";
import { GenericTemplate, WiringRule } from "./types";
import {
  buildEdges,
  buildNodes,
  type WiringCanvasStore,
} from "./useWiringCanvasStore";
import {
  ConstantType,
  TemplatePorts,
  WiringCanvasConstantBlock,
  WiringCanvasExternalTemplate,
} from "./WiringCanvas.types";
import {
  DRAG_TYPE,
  DRAG_TYPE_CONSTANT,
  DRAG_TYPE_EXTERNAL,
} from "./WiringCanvasSidebar";

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
  onConstantAdd: (type: ConstantType, id?: string) => void;
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
    onConstantAdd,
    onConstantRemove,
    onConstantUpdate,
    onConstantDefaultValueUpdate,
  } = params;

  const { fitView, screenToFlowPosition } = useReactFlow();
  const autoLayout = useStore((state) => state.autoLayout);
  const lastLayout = useRef("");

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
    let positions: Record<string, { x: number; y: number }>;
    if (autoLayout) {
      positions = computeDiagramLayout(
        selectedTemplates,
        externalTemplates,
        constants,
        wiring,
      );
    } else {
      // Merge persisted node positions with any pending drop positions
      positions = { ...dropPositions };
      for (const node of currentNodes) {
        if (node.position) {
          positions[node.id] = node.position;
        }
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
    });

    useStore.setState({ nodes: nextNodes, edges: nextEdges });

    // Re-fit once React Flow has measured the new layout
    const layoutKey = autoLayout ? JSON.stringify(positions) : "";
    if (layoutKey && layoutKey !== lastLayout.current) {
      // Recorded only once the fit runs, so a cancelled frame is retried
      const frame = requestAnimationFrame(() => {
        lastLayout.current = layoutKey;
        void fitView({ maxZoom: 1, padding: 0.2, duration: 300 });
      });
      return () => cancelAnimationFrame(frame);
    }
    if (!autoLayout) lastLayout.current = "";
  }, [
    autoLayout,
    fitView,
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

      const source = parseSourceHandle(conn.sourceHandle);
      const target = parseTargetHandle(conn.targetHandle);

      const exists = wiring.some(
        (w) =>
          w.source_template_id === sourceId &&
          w.source_output === source.name &&
          (w.source_type ?? "output") === source.type &&
          w.target_template_id === conn.target &&
          w.target_variable === target.name &&
          (w.target_type ?? "variable") === target.type,
      );
      if (exists) return;

      useStore.getState().setAutoLayout(false);
      onWiringChange([
        ...wiring,
        {
          source_template_id: sourceId,
          source_output: source.name,
          target_template_id: conn.target,
          target_variable: target.name,
          source_type: source.type,
          target_type: target.type,
        },
      ]);
    },
    [wiring, onWiringChange, useStore],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      const ids = new Set(deleted.map((e) => e.id));
      useStore.getState().setAutoLayout(false);
      onWiringChange(wiring.filter((_w, i) => !ids.has(`wire-${i}`)));
    },
    [wiring, onWiringChange, useStore],
  );

  // Put every node back into the dependency layout (same as the read-only
  // diagram's Auto arrange) and keep arranging until the user moves nodes.
  const autoArrange = useCallback(() => {
    lastLayout.current = "";
    useStore.getState().setAutoLayout(true);
    // Already in auto mode: positions did not change, so just re-fit
    requestAnimationFrame(() =>
      fitView({ maxZoom: 1, padding: 0.2, duration: 300 }),
    );
  }, [useStore, fitView]);

  const handleDragOver = useCallback((e: DragEvent) => {
    if (
      e.dataTransfer.types.includes(DRAG_TYPE) ||
      e.dataTransfer.types.includes(DRAG_TYPE_EXTERNAL) ||
      e.dataTransfer.types.includes(DRAG_TYPE_CONSTANT)
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

        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
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

        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        useStore.getState().setDropPosition(`ext-${extTemplate.id}`, position);
        onExternalTemplateAdd(extTemplate);
        return;
      }

      const constantType = e.dataTransfer.getData(DRAG_TYPE_CONSTANT);
      if (constantType === "string" || constantType === "number") {
        e.preventDefault();
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        // Pick the id here so the node lands where it was dropped
        const id = randomUUID();
        useStore.getState().setDropPosition(`const-${id}`, position);
        onConstantAdd(constantType, id);
      }
    },
    [
      onConstantAdd,
      screenToFlowPosition,
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
    autoArrange,
    selectedIds,
    externalTemplateIds,
  };
}
