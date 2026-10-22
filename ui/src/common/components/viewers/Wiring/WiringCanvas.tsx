import {
  DragEvent,
  KeyboardEvent,
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ReactFlowProvider } from "@xyflow/react";

import {
  HeroAdjustmentsHorizontalIcon,
  HeroLinkIcon,
  HeroXMarkIcon,
} from "../../../../icons";
import { cn } from "../../../../utils/cn";
import { randomUUID } from "../../../../utils/uuid";
import { notify } from "../../../hooks/useNotification";

import {
  CanvasGrid,
  DRAG_TYPES,
  DropOverlay,
  EmptyCanvas,
  FlowZoomToolbar,
  paintGrid,
  Point,
  PortLegend,
  SelectionHint,
  ToolButton,
  ViewToolbar,
  wireEndsOf,
} from "./CanvasChrome";
import {
  describeGraph,
  layoutSignature,
  nodeIdOf,
  wiringRuleKey,
} from "./graph";
import { computeDiagramLayout, withAncestorColumn } from "./layout";
import { DROP_ANCHOR } from "./NodeCard";
import { GenericTemplate } from "./types";
import { WirePopover } from "./WirePopover";
import {
  ConstantType,
  WiringCanvasExternalTemplate,
  WiringCanvasProps,
} from "./WiringCanvas.types";
import {
  SelectedWire,
  WiringEditor,
  WiringEditorHandlers,
  WiringFlow,
} from "./WiringFlow";
import {
  DRAG_TYPE,
  DRAG_TYPE_CONSTANT,
  DRAG_TYPE_EXTERNAL,
} from "./WiringLibrary";
import { WiringLibrary } from "./WiringLibrary";

// Re-render only when their own props change, not on every keystroke in
// the details form or every zoom step
const Library = memo(WiringLibrary);
const Flow = memo(WiringFlow);

export interface WiringCanvasEditorProps extends WiringCanvasProps {
  /** Form fields shown in a panel on the right of the canvas. */
  details?: ReactNode;
  detailsTitle?: string;
  /** Opens the details panel, e.g. when one of its fields is invalid. */
  detailsInvalid?: boolean;
  /** Size of the canvas when not fullscreen; defaults to filling the parent. */
  className?: string;
}

/**
 * Blueprint wiring editor: drag templates, parent resources and constants
 * from the library, then wire outputs to inputs.
 */
export function WiringCanvas(props: WiringCanvasEditorProps) {
  // The zoom toolbar and wire popover read the view from the flow store
  return (
    <ReactFlowProvider>
      <WiringCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function WiringCanvasInner(props: WiringCanvasEditorProps) {
  const {
    selectedTemplates,
    wiring,
    templatePorts,
    externalTemplates,
    constants,
    missingParentTemplates,
    onTemplateAdd,
    onExternalTemplateAdd,
    onConstantAdd,
    details,
    detailsTitle = "Details",
    detailsInvalid,
    className,
  } = props;

  const propsRef = useRef(props);
  propsRef.current = props;

  const [fullscreen, setFullscreen] = useState(false);
  const [wire, setWire] = useState<SelectedWire | null>(null);
  const [editor, setEditor] = useState<WiringEditor | null>(null);
  const [selection, setSelection] = useState({ nodes: 0, connection: false });
  const [dragOver, setDragOver] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const showDetails = Boolean(details) && detailsOpen;
  const shellRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Arrange nodes by dependency until the user moves a node or edits wires
  const autoLayout = useRef(true);
  const lastLayout = useRef("");
  const drops = useRef<Record<string, Point>>({});

  // Created once: they read the latest props through `propsRef`
  const handlers = useMemo<WiringEditorHandlers>(
    () => ({
      onWiringEdit: ({ added, removed }) => {
        const p = propsRef.current;
        const gone = new Set(removed);
        const next = p.wiring.filter((w) => !gone.has(wiringRuleKey(w)));
        const keys = new Set(next.map(wiringRuleKey));
        for (const rule of added) {
          if (keys.has(wiringRuleKey(rule))) continue;
          keys.add(wiringRuleKey(rule));
          next.push(rule);
        }
        autoLayout.current = false;
        p.onWiringChange(next);
      },
      onNodeRemove: (spec) => {
        const p = propsRef.current;
        if (spec.kind === "ancestor") return;
        if (spec.kind === "template") p.onTemplateRemove(spec.entityId);
        else if (spec.kind === "external") {
          p.onExternalTemplateRemove(spec.entityId);
        } else p.onConstantRemove(spec.entityId);
      },
      onConstantChange: (id, patch) => {
        const p = propsRef.current;
        if (patch.name !== undefined) p.onConstantUpdate(id, patch.name);
        if (patch.defaultValue !== undefined) {
          p.onConstantDefaultValueUpdate(id, patch.defaultValue);
        }
      },
      onNodeMoved: () => {
        autoLayout.current = false;
      },
      // Panning repaints the grid directly instead of re-rendering
      onTransform: (t) => paintGrid(gridRef.current, t),
      onSelectionChange: (next) =>
        setSelection((prev) =>
          prev.nodes === next.nodes && prev.connection === next.connection
            ? prev
            : next,
        ),
      onWireSelect: setWire,
    }),
    [],
  );

  const graph = useMemo(
    () =>
      describeGraph({
        selectedTemplates,
        externalTemplates,
        constants,
        templatePorts,
        wiring,
      }),
    [selectedTemplates, externalTemplates, constants, templatePorts, wiring],
  );

  const layoutGrid = useCallback(
    () =>
      withAncestorColumn(
        computeDiagramLayout(
          selectedTemplates,
          externalTemplates,
          constants,
          wiring,
        ),
        graph.nodes.filter((n) => n.kind === "ancestor").map((n) => n.id),
      ),
    [selectedTemplates, externalTemplates, constants, wiring, graph],
  );

  // Push prop changes into the editor, then lay out or place new nodes
  useEffect(() => {
    if (!editor) return;
    void (async () => {
      const added = await editor.sync(graph.nodes, graph.wires);
      if (autoLayout.current) {
        // Re-arrange only when something that affects the layout changed
        const signature = layoutSignature(graph.nodes, graph.wires);
        if (signature === lastLayout.current) return;
        lastLayout.current = signature;
        await editor.arrange(layoutGrid());
        await editor.fit();
      } else if (added.length > 0) {
        await editor.place(added, drops.current);
        for (const id of added) delete drops.current[id];
      }
    })();
  }, [editor, graph, layoutGrid]);

  useEffect(() => {
    if (detailsInvalid) setDetailsOpen(true);
  }, [detailsInvalid]);

  // Re-fit when the canvas goes in or out of fullscreen; opening the details
  // panel keeps the view the user has set
  useEffect(() => {
    if (!editor) return;
    const frame = requestAnimationFrame(() => void editor.fit());
    return () => cancelAnimationFrame(frame);
  }, [editor, fullscreen]);

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
    autoLayout.current = true;
    lastLayout.current = "";
    await editor.arrange(layoutGrid());
    await editor.fit();
  };

  const selectedIds = useMemo(
    () => new Set(selectedTemplates.map((t) => t.id)),
    [selectedTemplates],
  );
  const externalTemplateIds = useMemo(
    () => new Set(externalTemplates.map((t) => t.id)),
    [externalTemplates],
  );

  // Added by click: placed in view, not laid out with the rest
  const libraryAdd = useMemo(
    () => ({
      template: (template: GenericTemplate) => {
        autoLayout.current = false;
        propsRef.current.onTemplateAdd(template);
      },
      external: (template: WiringCanvasExternalTemplate) => {
        autoLayout.current = false;
        propsRef.current.onExternalTemplateAdd(template);
      },
      constant: (type: ConstantType) => {
        autoLayout.current = false;
        propsRef.current.onConstantAdd(type);
      },
    }),
    [],
  );

  const hasDragData = (e: DragEvent) =>
    DRAG_TYPES.some((type) => e.dataTransfer.types.includes(type));

  const handleDragOver = (e: DragEvent) => {
    if (!hasDragData(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  };

  const handleDrop = (e: DragEvent) => {
    setDragOver(false);
    if (!editor || !hasDragData(e)) return;
    e.preventDefault();
    const pointer = editor.pointerPosition(e.nativeEvent);
    const at = { x: pointer.x - DROP_ANCHOR.x, y: pointer.y - DROP_ANCHOR.y };
    const dropAt = (nodeId: string) => {
      drops.current[nodeId] = at;
      autoLayout.current = false;
    };

    const parse = <T,>(raw: string): T | null => {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    };

    const rawTemplate = e.dataTransfer.getData(DRAG_TYPE);
    if (rawTemplate) {
      const template = parse<GenericTemplate>(rawTemplate);
      if (!template) return;
      if (selectedIds.has(template.id)) return;
      dropAt(nodeIdOf("template", template.id));
      onTemplateAdd(template);
      return;
    }
    const rawExternal = e.dataTransfer.getData(DRAG_TYPE_EXTERNAL);
    if (rawExternal) {
      const template = parse<WiringCanvasExternalTemplate>(rawExternal);
      if (!template) return;
      if (externalTemplateIds.has(template.id)) return;
      dropAt(nodeIdOf("external", template.id));
      onExternalTemplateAdd(template);
      return;
    }
    const constantType = e.dataTransfer.getData(DRAG_TYPE_CONSTANT);
    if (constantType === "string" || constantType === "number") {
      // Pick the id here so the node lands where it was dropped
      const id = randomUUID();
      dropAt(nodeIdOf("constant", id));
      onConstantAdd(constantType, id);
    }
  };

  const autoWire = () => {
    if (!editor) return;
    const { added, ambiguous } = editor.autoWire();
    if (added > 0) {
      notify(`Added ${added} wire${added > 1 ? "s" : ""} by name`, "success");
    } else if (ambiguous.length === 0) {
      notify("No free input or config matches a source by name", "info");
    }
    if (ambiguous.length > 0) {
      notify(
        `Skipped ${ambiguous.length} port${ambiguous.length > 1 ? "s" : ""} that several sources match`,
        "warning",
        { description: ambiguous.join(", ") },
      );
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, [contenteditable]")) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      void editor?.deleteSelection();
    } else if (e.key === "Escape" && !fullscreen) {
      void editor?.clearSelection();
    }
  };

  const isEmpty = graph.nodes.length === 0;

  // Both ends of the clicked wire, looked up in the current graph
  const wireEnds = useMemo(
    () => (wire ? wireEndsOf(graph.nodes, wire) : null),
    [wire, graph.nodes],
  );

  return (
    <div
      ref={shellRef}
      className={cn(
        "flex w-full overflow-hidden bg-paper text-fg",
        fullscreen
          ? "fixed inset-0 z-1300 h-screen"
          : cn(
              "rounded-surface border border-divider",
              className ?? "min-h-[480px] flex-1",
            ),
      )}
    >
      <Library
        selectedIds={selectedIds}
        externalTemplateIds={externalTemplateIds}
        missingParentTemplates={missingParentTemplates}
        onTemplateAdd={libraryAdd.template}
        onExternalTemplateAdd={libraryAdd.external}
        onConstantAdd={libraryAdd.constant}
      />

      <div
        className="relative min-w-0 flex-1 bg-canvas outline-none"
        tabIndex={0}
        aria-label="Wiring canvas"
        onKeyDown={handleKeyDown}
        // Capture: wires and nodes stop the event before it bubbles here
        onPointerDownCapture={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest("input, textarea, button")) {
            e.currentTarget.focus({ preventScroll: true });
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setDragOver(false);
          }
        }}
        onDrop={handleDrop}
      >
        <CanvasGrid gridRef={gridRef} />
        <Flow ref={setEditor} handlers={handlers} />

        {dragOver && <DropOverlay />}
        {isEmpty && !dragOver && <EmptyCanvas />}

        <ViewToolbar
          leading={
            <>
              <ToolButton
                label="Wire inputs to outputs, configs and constants with the same name"
                disabled={isEmpty}
                onClick={autoWire}
              >
                <HeroLinkIcon className="text-[16px]" />
              </ToolButton>
              {details && (
                <ToolButton
                  label={
                    showDetails
                      ? `Hide ${detailsTitle.toLowerCase()}`
                      : `Show ${detailsTitle.toLowerCase()}`
                  }
                  active={showDetails}
                  onClick={() => setDetailsOpen((v) => !v)}
                >
                  <HeroAdjustmentsHorizontalIcon className="text-[16px]" />
                </ToolButton>
              )}
            </>
          }
          fullscreen={fullscreen}
          onArrange={() => void autoArrange()}
          onFit={() => void editor?.fit()}
          onFullscreenToggle={() => setFullscreen((v) => !v)}
        />

        {wire && wireEnds && (
          <WirePopover
            from={wireEnds.from}
            to={wireEnds.to}
            at={wire.at}
            locked={wire.locked}
            inherited={wire.inherited}
            onRemove={() => void editor?.removeConnection(wire.id)}
            onClose={() => void editor?.clearSelection()}
          />
        )}

        {!wire && selection.nodes > 0 && (
          <SelectionHint nodes={selection.nodes} />
        )}

        <FlowZoomToolbar
          onZoomIn={() => void editor?.zoomBy(1.2)}
          onZoomOut={() => void editor?.zoomBy(1 / 1.2)}
        />
        <PortLegend />
      </div>

      {showDetails && (
        <aside
          aria-label={detailsTitle}
          className="flex w-80 shrink-0 flex-col border-l border-divider bg-canvas"
        >
          <div className="flex min-h-12 items-center justify-between gap-2 border-b border-divider px-4">
            <h3 className="m-0 text-[0.875rem] font-semibold text-fg-muted">
              {detailsTitle}
            </h3>
            <ToolButton
              label={`Hide ${detailsTitle.toLowerCase()}`}
              onClick={() => setDetailsOpen(false)}
            >
              <HeroXMarkIcon className="text-[16px]" />
            </ToolButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {details}
          </div>
        </aside>
      )}
    </div>
  );
}
