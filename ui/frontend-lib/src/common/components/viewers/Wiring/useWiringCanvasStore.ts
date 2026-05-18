import type { Theme } from "@mui/material";
import {
  type Edge,
  type OnEdgesChange,
  type OnNodesChange,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
} from "@xyflow/react";
import { create } from "zustand";

import { ENTITY_STATUS } from "../../../../utils";

import { DiagramNode } from "./helpers";
import { GenericStep, GenericTemplate, WiringRule } from "./types";
import { TemplatePorts } from "./WiringCanvas.types";

export type WiringCanvasState = {
  nodes: DiagramNode[];
  edges: Edge[];
  dropPositions: Record<string, { x: number; y: number }>;
  onNodesChange: OnNodesChange<DiagramNode>;
  onEdgesChange: OnEdgesChange;
  setNodes: (nodes: DiagramNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  setDropPosition: (id: string, pos: { x: number; y: number }) => void;
};

// Factory: one store per WiringCanvas instance
export const createWiringCanvasStore = () =>
  create<WiringCanvasState>((set, get) => ({
    nodes: [],
    edges: [],
    dropPositions: {},
    onNodesChange: (changes) => {
      set({ nodes: applyNodeChanges(changes, get().nodes) });
    },
    onEdgesChange: (changes) => {
      set({ edges: applyEdgeChanges(changes, get().edges) });
    },
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    setDropPosition: (id, pos) =>
      set((s) => ({ dropPositions: { ...s.dropPositions, [id]: pos } })),
  }));

export type WiringCanvasStore = ReturnType<typeof createWiringCanvasStore>;

// Pure helpers to build nodes & edges from external props

export function buildNodes(params: {
  selectedTemplates: GenericTemplate[];
  templatePorts: Record<string, TemplatePorts>;
  externalTemplates: Array<{
    id: string;
    name: string;
    abstract?: boolean;
    resource?: { id: string; name: string; status: ENTITY_STATUS };
  }>;
  constants: Array<{
    id: string;
    name: string;
    type?: string;
    defaultValue?: string;
  }>;
  positions: Record<string, { x: number; y: number }>;
  onTemplateRemove?: (templateId: string) => void;
  onExternalTemplateRemove?: (templateId: string) => void;
  onConstantRemove?: (constantId: string) => void;
  onConstantUpdate?: (constantId: string, name: string) => void;
  onConstantDefaultValueUpdate?: (
    constantId: string,
    defaultValue: string,
  ) => void;
  stepByTemplate?: Map<string, GenericStep>;
}): DiagramNode[] {
  const {
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
    stepByTemplate,
  } = params;

  const templateNodes: DiagramNode[] = selectedTemplates.map((t, i) => {
    const pos = positions[t.id] || { x: 260 + i * 360, y: 50 };
    const ports = templatePorts[t.id] || { inputs: [], outputs: [] };
    const step = stepByTemplate?.get(t.id);
    return {
      id: t.id,
      type: "templateNode" as const,
      position: pos,
      data: {
        label: t.name,
        templateId: t.id,
        order: i + 1,
        inputs: ports.inputs,
        outputs: ports.outputs,
        kind: "template",
        onRemove: onTemplateRemove,
        status: step?.status,
        errorMessage: step?.error_message,
        resourceId: step?.resource_id,
        resourceName: step?.resource?.name,
        stepPosition: step?.position,
      },
    };
  });

  const extNodes: DiagramNode[] = externalTemplates.map((t, i) => {
    const pos = positions[`ext-${t.id}`] || { x: 40, y: 50 + i * 250 };
    const ports = templatePorts[t.id] || { inputs: [], outputs: [] };
    return {
      id: `ext-${t.id}`,
      type: "externalTemplateNode" as const,
      position: pos,
      data: {
        label: t.name,
        templateId: t.id,
        inputs: [],
        outputs: ports.outputs,
        kind: "external",
        onRemove: onExternalTemplateRemove
          ? (templateId: string) => onExternalTemplateRemove(templateId)
          : undefined,
        resourceId: t.resource?.id,
        resourceName: t.resource?.name,
        status: t.resource?.status,
      },
    };
  });

  const constNodes: DiagramNode[] = constants.map((c, i) => {
    const pos = positions[`const-${c.id}`] || {
      x: 40,
      y: 50 + (externalTemplates.length + i) * 250,
    };
    const ports = templatePorts[c.id] || { inputs: [], outputs: [] };
    const constOutputs =
      ports.outputs.length > 0 ? ports.outputs : [c.name || "value"];
    return {
      id: `const-${c.id}`,
      type: "constantNode" as const,
      position: pos,
      data: {
        label: c.name || "Constant",
        templateId: c.id,
        inputs: [],
        outputs: constOutputs,
        kind: "constant",
        constantId: c.id,
        constantType: c.type || "string",
        defaultValue: c.defaultValue,
        name: c.name,
        onRemove: onConstantRemove,
        onUpdate: onConstantUpdate,
        onDefaultValueUpdate: onConstantDefaultValueUpdate,
      },
    };
  });

  return [...extNodes, ...constNodes, ...templateNodes];
}

export function buildEdges(params: {
  wiring: WiringRule[];
  selectedTemplates: GenericTemplate[];
  externalTemplates: Array<{ id: string; name: string }>;
  constants: Array<{ id: string; name: string }>;
  theme: Theme;
  stepByTemplate?: Map<string, GenericStep>;
}): Edge[] {
  const {
    wiring,
    selectedTemplates,
    externalTemplates,
    constants,
    theme,
    stepByTemplate,
  } = params;

  return wiring
    .map((w, i) => {
      const constant = constants.find((c) => c.id === w.source_template_id);
      const isConstantWire = !!constant;
      const isExternalWire =
        !isConstantWire &&
        externalTemplates.some((t) => t.id === w.source_template_id);

      const sourceNodeId = isConstantWire
        ? `const-${w.source_template_id}`
        : isExternalWire
          ? `ext-${w.source_template_id}`
          : w.source_template_id;

      const displaySourceName = isConstantWire
        ? constant?.name || "value"
        : w.source_output;

      const sourceHandle = isConstantWire
        ? `output-${constant?.name || "value"}`
        : `output-${w.source_output}`;

      // Step-based coloring (workflow mode) or wire-type coloring
      const sourceStep = stepByTemplate?.get(w.source_template_id);
      const strokeColor = sourceStep
        ? sourceStep.status === "done"
          ? theme.palette.success.main
          : sourceStep.status === "error"
            ? theme.palette.error.main
            : sourceStep.status === "in_progress"
              ? theme.palette.info.main
              : theme.palette.grey[500]
        : isConstantWire
          ? theme.palette.secondary.main
          : theme.palette.primary.main;

      const animated = stepByTemplate
        ? sourceStep?.status === "in_progress" || sourceStep?.status === "done"
        : true;

      const sourceExists =
        isConstantWire ||
        externalTemplates.some((t) => t.id === w.source_template_id) ||
        selectedTemplates.some((t) => t.id === w.source_template_id);
      const targetExists = selectedTemplates.some(
        (t) => t.id === w.target_template_id,
      );

      if (!sourceExists || !targetExists) {
        return null;
      }

      return {
        id: `wire-${i}`,
        source: sourceNodeId,
        sourceHandle,
        target: w.target_template_id,
        targetHandle: `input-${w.target_variable}`,
        animated,
        style: {
          stroke: strokeColor,
          strokeWidth: 2,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
        label: `${displaySourceName} -> ${w.target_variable}`,
        labelStyle: { fontSize: 11, fill: theme.palette.text.secondary },
        interactionWidth: 20,
      } as Edge;
    })
    .filter((edge): edge is Edge => edge !== null);
}
