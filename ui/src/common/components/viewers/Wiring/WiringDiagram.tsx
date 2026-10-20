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
import { computeDiagramLayout } from "./layout";
import { TemplateNode } from "./TemplateNode";
import { GenericStep, GenericTemplate, WiringRule } from "./types";
import {
  buildEdges,
  buildNodes,
  createWiringCanvasStore,
  type WiringCanvasState,
} from "./useWiringCanvasStore";
import { TemplatePorts } from "./WiringCanvas.types";

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
