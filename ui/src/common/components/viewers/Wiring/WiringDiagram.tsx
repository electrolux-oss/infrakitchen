import { useEffect, useMemo, useState } from "react";

import {
  Background,
  Controls,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useShallow } from "zustand/react/shallow";

import {
  HeroArrowsPointingInIcon,
  HeroArrowsPointingOutIcon,
  HeroSquares2X2Icon,
} from "../../../../icons";
import {
  IconButton,
  Tooltip,
  Dialog,
  DialogContent,
  useColorScheme,
} from "../../../../ui";
import { cn } from "../../../../utils/cn";
import { useFillViewportHeight } from "../../../hooks/useFillViewportHeight";

import { ConstantNode } from "./ConstantNode";
import { ExternalNode } from "./ExternalNode";
import { DiagramNode } from "./helpers";
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
const DEFAULT_HEIGHT = 600;
const MIN_FILL_HEIGHT = 400;
// Room kept below a "fill" canvas for the enclosing card and page padding.
const FILL_BOTTOM_OFFSET = 88;
const EMPTY_CONSTANTS: Array<{ id: string; name: string }> = [];

/**
 * Derives input/output port names for every node from the wiring rules.
 */
function derivePorts(
  templates: GenericTemplate[],
  externalTemplates: Array<{ id: string; name: string }>,
  constants: Array<{ id: string; name: string }>,
  wiring: WiringRule[],
): Record<string, TemplatePorts> {
  const m: Record<
    string,
    { inputs: Set<string>; outputs: Set<string>; configs: Set<string> }
  > = {};
  const ensure = (id: string) => {
    if (!m[id])
      m[id] = { inputs: new Set(), outputs: new Set(), configs: new Set() };
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
    } else if (w.source_type === "dependency_config") {
      m[w.source_template_id]?.configs.add(w.source_output);
    } else {
      m[w.source_template_id]?.outputs.add(w.source_output);
    }

    ensure(w.target_template_id);
    if (w.target_type === "dependency_config") {
      m[w.target_template_id]?.configs.add(w.target_variable);
    } else {
      m[w.target_template_id]?.inputs.add(w.target_variable);
    }
  }

  return Object.fromEntries(
    Object.entries(m).map(([id, sets]) => [
      id,
      {
        inputs: [...sets.inputs],
        outputs: [...sets.outputs],
        configs: [...sets.configs],
      },
    ]),
  );
}

/**
 * Groups templates into columns by dependency: a template that consumes
 * another template's output is placed one column after its deepest
 * dependency (longest path). Within a column templates are ordered by the
 * average row of their dependencies to reduce edge crossings. Wiring cycles
 * are ignored.
 */
function computeDependencyColumns(
  templates: GenericTemplate[],
  wiring: WiringRule[],
): GenericTemplate[][] {
  const index = new Map(templates.map((t, i) => [t.id, i]));
  const dependencies = new Map<string, Set<string>>(
    templates.map((t) => [t.id, new Set()]),
  );
  for (const w of wiring) {
    if (
      w.source_template_id !== w.target_template_id &&
      index.has(w.source_template_id) &&
      index.has(w.target_template_id)
    ) {
      dependencies.get(w.target_template_id)!.add(w.source_template_id);
    }
  }

  const column = new Map<string, number>();
  const visiting = new Set<string>();
  const columnOf = (id: string): number => {
    const known = column.get(id);
    if (known !== undefined) return known;
    visiting.add(id);
    let col = 0;
    for (const dep of dependencies.get(id)!) {
      if (!visiting.has(dep)) col = Math.max(col, columnOf(dep) + 1);
    }
    visiting.delete(id);
    column.set(id, col);
    return col;
  };

  const columns: GenericTemplate[][] = [];
  for (const t of templates) {
    const col = columnOf(t.id);
    (columns[col] ??= []).push(t);
  }

  const row = new Map<string, number>();
  for (const group of columns) {
    if (!group) continue;
    const weight = (t: GenericTemplate) => {
      const rows = [...dependencies.get(t.id)!]
        .map((dep) => row.get(dep))
        .filter((r): r is number => r !== undefined);
      return rows.length
        ? rows.reduce((a, b) => a + b, 0) / rows.length
        : index.get(t.id)!;
    };
    group.sort(
      (a, b) => weight(a) - weight(b) || index.get(a.id)! - index.get(b.id)!,
    );
    group.forEach((t, i) => row.set(t.id, i));
  }

  return columns.filter(Boolean);
}

/**
 * Pre-computes grid positions for the read-only diagram layout.
 */
function computeDiagramLayout(
  templates: GenericTemplate[],
  externalTemplates: Array<{ id: string; name: string }>,
  constants: Array<{ id: string; name: string }>,
  wiring: WiringRule[],
  stepByTemplate?: Map<string, GenericStep>,
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
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
    computeDependencyColumns(templates, wiring).forEach((group, col) => {
      group.forEach((t, row) => {
        positions[t.id] = {
          x: xOffset + col * COL_WIDTH,
          y: 40 + row * ROW_HEIGHT,
        };
      });
    });
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
  externalTemplates: Array<{ id: string; name: string }>;
  constants?: Array<{ id: string; name: string }>;
  /** Canvas height in px, or "fill" to take the rest of the viewport. */
  height?: number | "fill";
  /**
   * Workflow steps - when provided, enables workflow mode:
   * status-coloured nodes/edges, resource links, selectable nodes,
   * and external templates are auto-derived from the wiring.
   */
  steps?: GenericStep[];
  /** Show a fullscreen toggle button. */
  allowFullscreen?: boolean;
}

export const WiringDiagram = ({
  templates,
  wiring,
  externalTemplates,
  constants = EMPTY_CONSTANTS,
  height = DEFAULT_HEIGHT,
  steps,
  allowFullscreen = false,
}: WiringDiagramProps) => {
  const { resolvedMode: mode } = useColorScheme();
  const [fullscreen, setFullscreen] = useState(false);
  const [flow, setFlow] = useState<ReactFlowInstance<DiagramNode>>();

  const { ref: fillRef, height: fillHeight } = useFillViewportHeight({
    enabled: height === "fill",
    bottomOffset: FILL_BOTTOM_OFFSET,
    minHeight: MIN_FILL_HEIGHT,
  });
  const canvasHeight =
    height === "fill" ? (fillHeight ?? DEFAULT_HEIGHT) : height;

  const isWorkflowMode = steps !== undefined;

  // Build template-id -> step lookup for O(1) access in builders.
  const stepByTemplate = useMemo(() => {
    if (!steps) return undefined;
    const m = new Map<string, GenericStep>();
    for (const s of steps) {
      if (s.template_id) m.set(s.template_id, s);
    }
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
        stepByTemplate,
      ),
    [templates, externalTemplates, constants, wiring, stepByTemplate],
  );

  const computedNodes = useMemo(
    () =>
      buildNodes({
        selectedTemplates: templates,
        templatePorts,
        externalTemplates,
        constants,
        positions,
        stepByTemplate,
      }),
    [
      templates,
      templatePorts,
      externalTemplates,
      constants,
      positions,
      stepByTemplate,
    ],
  );

  const computedEdges = useMemo(
    () =>
      buildEdges({
        wiring,
        selectedTemplates: templates,
        externalTemplates,
        constants,
        stepByTemplate,
      }),
    [wiring, templates, externalTemplates, constants, stepByTemplate],
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

  // The "fill" height is only known after the first paint, so re-fit once the
  // canvas has been resized to it.
  useEffect(() => {
    if (fillHeight === undefined) return;
    const frame = requestAnimationFrame(() =>
      flow?.fitView({ maxZoom: 1, padding: 0.2 }),
    );
    return () => cancelAnimationFrame(frame);
  }, [fillHeight, flow]);

  // Put dragged nodes back into the dependency layout and re-fit the view
  // once React Flow has measured the reset positions.
  const autoArrange = () => {
    useStore.setState({ nodes: computedNodes });
    requestAnimationFrame(() =>
      flow?.fitView({ maxZoom: 1, padding: 0.2, duration: 300 }),
    );
  };

  const canvas = (
    <div
      className={cn(
        fullscreen ? "border-0" : "border border-divider",
        fullscreen ? "rounded-none" : "rounded-surface",
        "relative w-full overflow-hidden",
      )}
      ref={fillRef}
      style={{ height: fullscreen ? "100%" : canvasHeight }}
    >
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        onInit={setFlow}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        // Cap at 1: React Flow's fitView otherwise upscales to 2x.
        fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
        // Dragging only moves nodes locally; the layout is never saved.
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={isWorkflowMode}
        proOptions={{ hideAttribution: true }}
        colorMode={mode === "dark" ? "dark" : "light"}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>

      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <Tooltip title="Auto arrange">
          <IconButton
            className="border border-divider bg-paper hover:bg-hover"
            size="small"
            aria-label="Auto arrange nodes"
            onClick={autoArrange}
          >
            <HeroSquares2X2Icon fontSize="small" />
          </IconButton>
        </Tooltip>
        {allowFullscreen && (
          <IconButton
            className="border border-divider bg-paper hover:bg-hover"
            size="small"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={() => setFullscreen((v) => !v)}
          >
            {fullscreen ? (
              <HeroArrowsPointingInIcon fontSize="small" />
            ) : (
              <HeroArrowsPointingOutIcon fontSize="small" />
            )}
          </IconButton>
        )}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <Dialog
        open
        fullScreen
        onClose={() => setFullscreen(false)}
        className="bg-canvas"
      >
        <DialogContent className="h-[100vh] p-0">{canvas}</DialogContent>
      </Dialog>
    );
  }

  return canvas;
};
