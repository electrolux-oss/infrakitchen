import { useEffect, useMemo, useState } from "react";

import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  useColorScheme,
  useTheme,
} from "@mui/material";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useShallow } from "zustand/react/shallow";

import { ConstantNode } from "./ConstantNode";
import { ExternalNode } from "./ExternalNode";
import { TemplateNode } from "./TemplateNode";
import { GenericStep, GenericTemplate, WiringRule } from "./types";
import {
  buildEdges,
  buildNodes,
  createWiringCanvasStore,
  type WiringCanvasState,
} from "./useWiringCanvasStore";
import { TemplatePorts } from "./WiringCanvas.types";

const COL_WIDTH = 360;
const ROW_HEIGHT = 280;
const EMPTY_CONSTANTS: Array<{ id: string; name: string }> = [];

/**
 * Derives input/output port names for every node from the wiring rules.
 */
function derivePorts(
  templates: GenericTemplate[],
  externalTemplates: Array<{ id: string; name: string; secondaryLabel?: string }>,
  constants: Array<{ id: string; name: string }>,
  wiring: WiringRule[],
): Record<string, TemplatePorts> {
  const m: Record<string, { inputs: Set<string>; outputs: Set<string> }> = {};
  const ensure = (id: string) => {
    if (!m[id]) m[id] = { inputs: new Set(), outputs: new Set() };
  };

  for (const t of templates) ensure(t.id);
  for (const e of externalTemplates) ensure(e.id);
  for (const c of constants) ensure(c.id);

  const constantIdSet = new Set(constants.map((c) => c.id));

  for (const w of wiring) {
    const isConstant = constantIdSet.has(w.source_template_id);

    if (isConstant) {
      const c = constants.find((c) => c.id === w.source_template_id);
      m[w.source_template_id]?.outputs.add(c?.name ?? "value");
    } else {
      m[w.source_template_id]?.outputs.add(w.source_output);
    }

    ensure(w.target_template_id);
    m[w.target_template_id]?.inputs.add(w.target_variable);
  }

  return Object.fromEntries(
    Object.entries(m).map(([id, sets]) => [
      id,
      { inputs: [...sets.inputs], outputs: [...sets.outputs] },
    ]),
  );
}

/**
 * Pre-computes grid positions for the read-only diagram layout.
 */
function computeDiagramLayout(
  templates: GenericTemplate[],
  externalTemplates: Array<{ id: string; name: string; secondaryLabel?: string }>,
  constants: Array<{ id: string; name: string }>,
  wiring: WiringRule[],
  layoutDirection: "left-to-right" | "top-to-bottom",
  stepByTemplate?: Map<string, GenericStep>,
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};

  if (layoutDirection === "top-to-bottom") {
    const templateIds = new Set(templates.map((t) => t.id));
    const depth = new Map<string, number>();

    for (const t of templates) {
      depth.set(t.id, 0);
    }

    // Relax edges to compute level(depth): parent is always above child.
    for (let i = 0; i < templates.length; i++) {
      let changed = false;
      for (const w of wiring) {
        if (!templateIds.has(w.target_template_id)) continue;
        const sourceDepth = templateIds.has(w.source_template_id)
          ? (depth.get(w.source_template_id) ?? 0)
          : 0;
        const targetDepth = depth.get(w.target_template_id) ?? 0;
        if (targetDepth < sourceDepth + 1) {
          depth.set(w.target_template_id, sourceDepth + 1);
          changed = true;
        }
      }
      if (!changed) break;
    }

    const byDepth = new Map<number, GenericTemplate[]>();
    for (const t of templates) {
      const d = depth.get(t.id) ?? 0;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d)!.push(t);
    }

    const maxDepth = Math.max(0, ...byDepth.keys());
    const maxWidth = Math.max(...Array.from(byDepth.values(), (g) => g.length), 1);
    const startX = 40;
    const startY = 40;
    const verticalGap = 220;
    const horizontalGap = 320;

    for (let d = 0; d <= maxDepth; d++) {
      const row = (byDepth.get(d) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
      const rowOffset = ((maxWidth - row.length) * horizontalGap) / 2;
      for (let i = 0; i < row.length; i++) {
        positions[row[i].id] = {
          x: startX + rowOffset + i * horizontalGap,
          y: startY + d * verticalGap,
        };
      }
    }

    const externalY = startY;
    externalTemplates.forEach((e, i) => {
      positions[`ext-${e.id}`] = {
        x: startX + i * horizontalGap,
        y: externalY,
      };
    });

    constants.forEach((c, i) => {
      positions[`const-${c.id}`] = {
        x: startX + (externalTemplates.length + i) * horizontalGap,
        y: externalY,
      };
    });

    return positions;
  }

  const hasLeft = externalTemplates.length > 0 || constants.length > 0;
  const xOffset = hasLeft ? COL_WIDTH : 0;

  for (let i = 0; i < externalTemplates.length; i++) {
    positions[`ext-${externalTemplates[i].id}`] = {
      x: 0,
      y: 40 + i * ROW_HEIGHT,
    };
  }

  for (let i = 0; i < constants.length; i++) {
    positions[`const-${constants[i].id}`] = {
      x: 0,
      y: 40 + (externalTemplates.length + i) * ROW_HEIGHT,
    };
  }

  if (stepByTemplate && stepByTemplate.size > 0) {
    const byPosition = new Map<number, GenericTemplate[]>();
    for (const t of templates) {
      const step = stepByTemplate.get(t.id);
      const pos = step?.position ?? 0;
      if (!byPosition.has(pos)) byPosition.set(pos, []);
      byPosition.get(pos)!.push(t);
    }

    const sortedCols = [...byPosition.keys()].sort((a, b) => a - b);
    for (let col = 0; col < sortedCols.length; col++) {
      const group = byPosition.get(sortedCols[col])!;
      for (let row = 0; row < group.length; row++) {
        positions[group[row].id] = {
          x: xOffset + col * COL_WIDTH,
          y: 40 + row * ROW_HEIGHT,
        };
      }
    }
  } else {
    for (let i = 0; i < templates.length; i++) {
      positions[templates[i].id] = { x: xOffset + i * COL_WIDTH, y: 40 };
    }
  }

  return positions;
}

const NODE_TYPES = {
  templateNode: TemplateNode,
  externalTemplateNode: ExternalNode,
  constantNode: ConstantNode,
};

export interface WiringDiagramProps {
  templates: GenericTemplate[];
  wiring: WiringRule[];
  externalTemplates: Array<{ id: string; name: string; secondaryLabel?: string }>;
  constants?: Array<{ id: string; name: string }>;
  height?: number;
  /**
   * Workflow steps - when provided, enables workflow mode:
   * status-coloured nodes/edges, resource links, draggable nodes,
   * and external templates are auto-derived from the wiring.
   */
  steps?: GenericStep[];
  /** Show a fullscreen toggle button (useful in workflow mode). */
  allowFullscreen?: boolean;
  /** Compact node rendering for read-only dependency views. */
  compactNodes?: boolean;
  /** Diagram orientation for auto-layout. */
  layoutDirection?: "left-to-right" | "top-to-bottom";
}

export const WiringDiagram = ({
  templates,
  wiring,
  externalTemplates,
  constants = EMPTY_CONSTANTS,
  height = 600,
  steps,
  allowFullscreen = false,
  compactNodes = false,
  layoutDirection = "left-to-right",
}: WiringDiagramProps) => {
  const theme = useTheme();
  const { mode } = useColorScheme();
  const [fullscreen, setFullscreen] = useState(false);

  const isWorkflowMode = steps !== undefined;

  // Build template-id -> step lookup for O(1) access in builders.
  const stepByTemplate = useMemo(() => {
    if (!steps) return undefined;
    const m = new Map<string, GenericStep>();
    for (const s of steps) m.set(s.template_id, s);
    return m;
  }, [steps]);

  const templatePorts = useMemo(
    () => derivePorts(templates, externalTemplates, constants, wiring),
    [templates, externalTemplates, constants, wiring],
  );

  const positions = useMemo(
    () =>
      computeDiagramLayout(
        templates,
        externalTemplates,
        constants,
        wiring,
        layoutDirection,
        stepByTemplate,
      ),
    [
      templates,
      externalTemplates,
      constants,
      wiring,
      layoutDirection,
      stepByTemplate,
    ],
  );

  const computedNodes = useMemo(
    () => {
      const nodes = buildNodes({
        selectedTemplates: templates,
        templatePorts,
        externalTemplates,
        constants,
        positions,
        stepByTemplate,
      });

      if (!compactNodes) {
        return nodes;
      }

      return nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          compactPorts: true,
          hideOrder: true,
        },
      }));
    },
    [
      templates,
      templatePorts,
      externalTemplates,
      constants,
      positions,
      stepByTemplate,
      compactNodes,
    ],
  );

  const computedEdges = useMemo(
    () => {
      const edges = buildEdges({
        wiring,
        selectedTemplates: templates,
        externalTemplates,
        constants,
        theme,
        stepByTemplate,
      });

      if (!compactNodes) {
        return edges;
      }

      return edges.map((edge) => ({
        ...edge,
        label: undefined,
      }));
    },
    [
      wiring,
      templates,
      externalTemplates,
      constants,
      theme,
      stepByTemplate,
      compactNodes,
    ],
  );

  const useStore = useMemo(() => createWiringCanvasStore(), []);

  const { nodes, edges, onNodesChange } = useStore(
    useShallow((state: WiringCanvasState) => ({
      nodes: state.nodes,
      edges: state.edges,
      onNodesChange: state.onNodesChange,
    })),
  );

  useEffect(() => {
    useStore.setState({ nodes: computedNodes, edges: computedEdges });
  }, [computedNodes, computedEdges, useStore]);

  const canvas = (
    <Box
      sx={{
        width: "100%",
        height: fullscreen ? "100%" : height,
        position: "relative",
        border: fullscreen ? "none" : `1px solid ${theme.palette.divider}`,
        borderRadius: fullscreen ? 0 : 2,
        overflow: "hidden",
      }}
    >
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={compactNodes ? { padding: 0.25 } : undefined}
        nodesDraggable={isWorkflowMode}
        nodesConnectable={false}
        elementsSelectable={isWorkflowMode}
        proOptions={{ hideAttribution: true }}
        colorMode={mode === "dark" ? "dark" : "light"}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {allowFullscreen && (
        <IconButton
          size="small"
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={() => setFullscreen((v) => !v)}
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 10,
            bgcolor: "background.paper",
            border: `1px solid ${theme.palette.divider}`,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          {fullscreen ? (
            <CloseFullscreenIcon fontSize="small" />
          ) : (
            <FullscreenIcon fontSize="small" />
          )}
        </IconButton>
      )}
    </Box>
  );

  if (fullscreen) {
    return (
      <Dialog
        open
        fullScreen
        onClose={() => setFullscreen(false)}
        PaperProps={{ sx: { bgcolor: "background.default" } }}
      >
        <DialogContent sx={{ p: 0, height: "100vh" }}>{canvas}</DialogContent>
      </Dialog>
    );
  }

  return canvas;
};
