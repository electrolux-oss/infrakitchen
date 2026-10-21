import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ReactFlowProvider } from "@xyflow/react";

import { cn } from "../../../../utils/cn";
import { useFillViewportHeight } from "../../../hooks/useFillViewportHeight";

import {
  CanvasGrid,
  FlowZoomToolbar,
  paintGrid,
  PortLegend,
  ViewToolbar,
  wireEndsOf,
} from "./CanvasChrome";
import {
  describeGraph,
  layoutSignature,
  NodeSpec,
  NodeStep,
  WireSpec,
} from "./graph";
import { computeDiagramLayout } from "./layout";
import { GenericStep, GenericTemplate, WiringRule } from "./types";
import { WirePopover } from "./WirePopover";
import { ConstantType, TemplatePorts } from "./WiringCanvas.types";
import {
  SelectedWire,
  WiringEditor,
  WiringEditorHandlers,
  WiringFlow,
} from "./WiringFlow";

const DEFAULT_HEIGHT = 600;
const MIN_FILL_HEIGHT = 400;
// Room kept below a "fill" canvas for the enclosing card and page padding.
const FILL_BOTTOM_OFFSET = 88;

interface DiagramConstant {
  id: string;
  name: string;
  type?: string;
  defaultValue?: string;
}

interface DiagramExternalTemplate {
  id: string;
  name: string;
  /** The existing resource used as the parent, in workflow mode. */
  resource?: { id: string; name?: string; status?: string } | null;
}

const EMPTY_CONSTANTS: DiagramConstant[] = [];

const Flow = memo(WiringFlow);

/** Wire colour by the status of the step that produces its value. */
const STEP_WIRE_COLOR: Record<string, string> = {
  done: "var(--color-success)",
  error: "var(--color-error)",
  in_progress: "var(--color-info)",
};
const PENDING_WIRE_COLOR = "var(--color-grey-500)";

/** Port names of every node, taken from the wiring alone. */
function derivePorts(
  nodeIds: string[],
  constants: DiagramConstant[],
  wiring: WiringRule[],
): Record<string, TemplatePorts> {
  const sets = new Map(
    nodeIds.map((id) => [
      id,
      {
        inputs: new Set<string>(),
        outputs: new Set<string>(),
        configs: new Set<string>(),
      },
    ]),
  );
  const constantIds = new Set(constants.map((c) => c.id));
  for (const w of wiring) {
    const source = sets.get(w.source_template_id);
    const target = sets.get(w.target_template_id);
    if (source && !constantIds.has(w.source_template_id)) {
      if (w.source_type === "dependency_config") {
        source.configs.add(w.source_output);
      } else source.outputs.add(w.source_output);
    }
    if (target) {
      if (w.target_type === "dependency_config") {
        target.configs.add(w.target_variable);
      } else target.inputs.add(w.target_variable);
    }
  }
  return Object.fromEntries(
    [...sets].map(([id, s]) => [
      id,
      {
        inputs: [...s.inputs],
        outputs: [...s.outputs],
        configs: [...s.configs],
      },
    ]),
  );
}

export interface WiringDiagramProps {
  templates: GenericTemplate[];
  wiring: WiringRule[];
  externalTemplates: DiagramExternalTemplate[];
  constants?: DiagramConstant[];
  /** Canvas height in px, or "fill" to take the rest of the viewport. */
  height?: number | "fill";
  /**
   * Workflow steps. When given, nodes show their run status, resource and
   * error, wires are coloured by the status of their source step, and the
   * layout follows the step order.
   */
  steps?: GenericStep[];
  /** Show a full screen button. */
  allowFullscreen?: boolean;
}

/** Read-only view of a blueprint's or workflow's wiring. */
export const WiringDiagram = (props: WiringDiagramProps) => (
  // The zoom toolbar and wire popover read the view from the flow store
  <ReactFlowProvider>
    <WiringDiagramInner {...props} />
  </ReactFlowProvider>
);

const WiringDiagramInner = ({
  templates,
  wiring,
  externalTemplates,
  constants = EMPTY_CONSTANTS,
  height = DEFAULT_HEIGHT,
  steps,
  allowFullscreen = false,
}: WiringDiagramProps) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [wire, setWire] = useState<SelectedWire | null>(null);
  const [editor, setEditor] = useState<WiringEditor | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const lastLayout = useRef("");

  const { ref: fillRef, height: fillHeight } = useFillViewportHeight({
    enabled: height === "fill",
    bottomOffset: FILL_BOTTOM_OFFSET,
    minHeight: MIN_FILL_HEIGHT,
  });
  const canvasHeight =
    height === "fill" ? (fillHeight ?? DEFAULT_HEIGHT) : height;

  const stepByTemplate = useMemo(() => {
    if (!steps) return undefined;
    const m = new Map<string, GenericStep>();
    for (const s of steps) if (s.template_id) m.set(s.template_id, s);
    return m;
  }, [steps]);

  const graph = useMemo(() => {
    const templatePorts = derivePorts(
      [...templates, ...externalTemplates].map((t) => t.id),
      constants,
      wiring,
    );
    const described = describeGraph({
      selectedTemplates: templates,
      externalTemplates,
      constants: constants.map((c) => ({
        id: c.id,
        name: c.name,
        type: (c.type === "number" ? "number" : "string") as ConstantType,
        defaultValue: c.defaultValue,
      })),
      templatePorts,
      wiring,
    });

    const order = new Map(templates.map((t, i) => [t.id, i + 1]));
    const resourceOf = new Map(
      externalTemplates.map((t) => [t.id, t.resource]),
    );
    const nodes: NodeSpec[] = described.nodes.map((n) => {
      let step: NodeStep | undefined;
      if (n.kind === "template") {
        const s = stepByTemplate?.get(n.entityId);
        step = {
          order: order.get(n.entityId),
          status: s?.status,
          errorMessage: s?.error_message,
          resourceId: s?.resource_id,
          resourceName: s?.resource?.name,
        };
      } else if (n.kind === "external") {
        const r = resourceOf.get(n.entityId);
        if (r) {
          step = { resourceId: r.id, resourceName: r.name, status: r.status };
        }
      }
      return step ? { ...n, step } : n;
    });

    const wires: WireSpec[] = stepByTemplate
      ? described.wires.map((w) => {
          const s = stepByTemplate.get(w.rule.source_template_id);
          return s
            ? { ...w, color: STEP_WIRE_COLOR[s.status] ?? PENDING_WIRE_COLOR }
            : w;
        })
      : described.wires;

    return { nodes, wires };
  }, [templates, externalTemplates, constants, wiring, stepByTemplate]);

  const handlers = useMemo<WiringEditorHandlers>(
    () => ({
      // A read-only canvas never edits, removes or reports changes
      onWiringEdit: () => undefined,
      onNodeRemove: () => undefined,
      onConstantChange: () => undefined,
      onNodeMoved: () => undefined,
      // Panning repaints the grid directly instead of re-rendering
      onTransform: (t) => paintGrid(gridRef.current, t),
      onSelectionChange: () => undefined,
      onWireSelect: setWire,
    }),
    [],
  );

  const layoutGrid = useCallback(
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

  // Show the data, and lay it out again when its shape changes. Dragging
  // only moves nodes locally; the layout is never saved.
  useEffect(() => {
    if (!editor) return;
    void (async () => {
      await editor.sync(graph.nodes, graph.wires);
      const signature = layoutSignature(graph.nodes, graph.wires);
      if (signature === lastLayout.current) return;
      lastLayout.current = signature;
      await editor.arrange(layoutGrid());
      await editor.fit();
    })();
  }, [editor, graph, layoutGrid]);

  // Re-fit when the canvas changes size
  useEffect(() => {
    if (!editor) return;
    const frame = requestAnimationFrame(() => void editor.fit());
    return () => cancelAnimationFrame(frame);
  }, [editor, fullscreen, canvasHeight]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const autoArrange = async () => {
    if (!editor) return;
    await editor.arrange(layoutGrid());
    await editor.fit();
  };

  const wireEnds = useMemo(
    () => (wire ? wireEndsOf(graph.nodes, wire) : null),
    [wire, graph.nodes],
  );

  return (
    <div
      ref={fillRef}
      className={cn(
        "relative w-full overflow-hidden bg-canvas",
        fullscreen
          ? "fixed inset-0 z-1300 h-screen"
          : "rounded-surface border border-divider",
      )}
      style={fullscreen ? undefined : { height: canvasHeight }}
    >
      <div
        className="absolute inset-0 outline-none"
        tabIndex={0}
        aria-label="Wiring diagram"
        onKeyDown={(e) => {
          if (e.key === "Escape") void editor?.clearSelection();
        }}
      >
        <CanvasGrid gridRef={gridRef} />
        <Flow ref={setEditor} handlers={handlers} readOnly />

        <ViewToolbar
          fullscreen={fullscreen}
          onArrange={() => void autoArrange()}
          onFit={() => void editor?.fit()}
          onFullscreenToggle={
            allowFullscreen ? () => setFullscreen((v) => !v) : undefined
          }
        />

        {wire && wireEnds && (
          <WirePopover
            from={wireEnds.from}
            to={wireEnds.to}
            at={wire.at}
            readOnly
            onRemove={() => undefined}
            onClose={() => void editor?.clearSelection()}
          />
        )}

        <FlowZoomToolbar
          onZoomIn={() => void editor?.zoomBy(1.2)}
          onZoomOut={() => void editor?.zoomBy(1 / 1.2)}
        />
        <PortLegend />
      </div>
    </div>
  );
};
