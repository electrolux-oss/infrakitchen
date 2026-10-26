import { ReactNode, Ref } from "react";

import { ReactFlowState, useStore } from "@xyflow/react";

import {
  HeroArrowsPointingInIcon,
  HeroArrowsPointingOutIcon,
  HeroMinusCircleIcon,
  HeroPlusCircleIcon,
  HeroRectangleGroupIcon,
  HeroSquares2X2Icon,
  HeroViewfinderCircleIcon,
} from "../../../../icons";
import { Tooltip } from "../../../../ui";
import { cn } from "../../../../utils/cn";

import {
  NodeSpec,
  PORT_COLOR,
  WIRE_COLOR,
  WIRE_TYPE_LABEL,
  WireSpec,
  WireType,
} from "./graph";
import { WireEnd } from "./WirePopover";
import {
  DRAG_TYPE,
  DRAG_TYPE_CONSTANT,
  DRAG_TYPE_EXTERNAL,
} from "./WiringLibrary";

/** Pieces of the wiring canvas UI shared by the editor and the read-only diagram. */

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 1.5;

export const DRAG_TYPES = [DRAG_TYPE, DRAG_TYPE_EXTERNAL, DRAG_TYPE_CONSTANT];

export type Point = { x: number; y: number };
export type Viewport = Point & { k: number };
/** Canvas pan (`x`, `y`) and zoom (`k`). */
export type Transform = Viewport;

const GRID = 24;
/** Every Nth grid line is drawn stronger. */
const GRID_MAJOR = 5;

// Line colours are mixed from the text colour, so they suit both themes
const MINOR_LINE = "color-mix(in srgb, var(--color-fg) 4%, transparent)";
const MAJOR_LINE = "color-mix(in srgb, var(--color-fg) 8%, transparent)";
const GRID_IMAGE = [
  `linear-gradient(to right, ${MAJOR_LINE} 1px, transparent 1px)`,
  `linear-gradient(to bottom, ${MAJOR_LINE} 1px, transparent 1px)`,
  `linear-gradient(to right, ${MINOR_LINE} 1px, transparent 1px)`,
  `linear-gradient(to bottom, ${MINOR_LINE} 1px, transparent 1px)`,
].join(", ");

export const gridSize = (k: number) => {
  const minor = `${GRID * k}px ${GRID * k}px`;
  const major = `${GRID * GRID_MAJOR * k}px ${GRID * GRID_MAJOR * k}px`;
  return `${major}, ${major}, ${minor}, ${minor}`;
};

/** Move the grid to a new view without re-rendering it. */
export function paintGrid(el: HTMLElement | null, t: Transform) {
  if (!el) return;
  el.style.backgroundSize = gridSize(t.k);
  el.style.backgroundPosition = `${t.x}px ${t.y}px`;
}

/** Grid lines that follow the canvas pan and zoom. */
export function CanvasGrid({
  viewport,
  gridRef,
}: {
  /** Omit when the grid is repainted directly through `gridRef`. */
  viewport?: Viewport;
  gridRef?: Ref<HTMLDivElement>;
}) {
  const v = viewport ?? { x: 0, y: 0, k: 1 };
  return (
    <div
      ref={gridRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: GRID_IMAGE,
        backgroundSize: gridSize(v.k),
        backgroundPosition: `${v.x}px ${v.y}px`,
      }}
    />
  );
}

export function Toolbar({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute z-10 flex items-center gap-0.5 rounded-lg border border-divider bg-paper p-1 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Shown pressed, for toggles. */
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip title={label}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent",
          active && "bg-selected text-fg",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function ToolbarDivider() {
  return <div className="mx-0.5 h-5 w-px bg-divider" />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-divider bg-canvas px-1 font-sans text-[11px] text-fg">
      {children}
    </kbd>
  );
}

/** Top-right: arrange, fit and full screen, after any `leading` buttons. */
export function ViewToolbar({
  leading,
  fullscreen,
  onArrange,
  onFit,
  onFullscreenToggle,
}: {
  leading?: ReactNode;
  fullscreen: boolean;
  onArrange: () => void;
  onFit: () => void;
  /** Omit to hide the full screen button. */
  onFullscreenToggle?: () => void;
}) {
  return (
    <Toolbar className="top-3 right-3">
      {leading && (
        <>
          {leading}
          <ToolbarDivider />
        </>
      )}
      <ToolButton label="Auto arrange" onClick={onArrange}>
        <HeroSquares2X2Icon className="text-[16px]" />
      </ToolButton>
      <ToolButton label="Fit to view" onClick={onFit}>
        <HeroViewfinderCircleIcon className="text-[16px]" />
      </ToolButton>
      {onFullscreenToggle && (
        <>
          <ToolbarDivider />
          <ToolButton
            label={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
            onClick={onFullscreenToggle}
          >
            {fullscreen ? (
              <HeroArrowsPointingInIcon className="text-[16px]" />
            ) : (
              <HeroArrowsPointingOutIcon className="text-[16px]" />
            )}
          </ToolButton>
        </>
      )}
    </Toolbar>
  );
}

/** Bottom-left: zoom out, current zoom, zoom in. */
export function ZoomToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <Toolbar className="bottom-3 left-3">
      <ToolButton
        label="Zoom out"
        disabled={zoom <= MIN_ZOOM + 0.001}
        onClick={onZoomOut}
      >
        <HeroMinusCircleIcon className="text-[16px]" />
      </ToolButton>
      <span className="w-11 text-center text-[12px] text-fg-muted tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <ToolButton
        label="Zoom in"
        disabled={zoom >= MAX_ZOOM - 0.001}
        onClick={onZoomIn}
      >
        <HeroPlusCircleIcon className="text-[16px]" />
      </ToolButton>
    </Toolbar>
  );
}

const zoomOf = (s: ReactFlowState) => s.transform[2];

/**
 * `ZoomToolbar` that reads the zoom from the React Flow store, so zooming
 * re-renders only the toolbar. Must sit inside a `ReactFlowProvider`.
 */
export function FlowZoomToolbar(props: {
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const zoom = useStore(zoomOf);
  return <ZoomToolbar zoom={zoom} {...props} />;
}

const LEGEND_WIRES: WireType[] = [
  "output",
  "config",
  "constant",
  "source",
  "inherited",
];

/** Bottom-right: what each port and wire colour means. */
export function PortLegend() {
  return (
    <div className="pointer-events-none absolute right-3 bottom-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col gap-1 rounded-lg border border-divider bg-paper/90 px-3 py-1.5 text-[11px] text-fg-muted shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">Ports</span>
        {(
          [
            ["input", "Input"],
            ["output", "Output"],
            ["config", "Dependency config"],
          ] as const
        ).map(([kind, label]) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ background: PORT_COLOR[kind] }}
            />
            {label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">Wires</span>
        {LEGEND_WIRES.map((type) => (
          <span key={type} className="flex items-center gap-1.5">
            <svg width="14" height="2" aria-hidden>
              <line
                x1="0"
                y1="1"
                x2="14"
                y2="1"
                stroke={WIRE_COLOR[type]}
                strokeWidth="2"
                strokeDasharray={type === "inherited" ? "3 2" : undefined}
              />
            </svg>
            {WIRE_TYPE_LABEL[type]}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-2 z-10 rounded-lg border-2 border-dashed border-info/60 bg-info/5" />
  );
}

export function EmptyCanvas() {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl border border-divider bg-paper text-fg-muted shadow-sm">
          <HeroRectangleGroupIcon className="text-[22px]" />
        </div>
        <div className="text-[14px] font-semibold">
          Start building your blueprint
        </div>
        <p className="mt-1 mb-0 text-[13px] text-fg-muted">
          Drag templates from the library onto the canvas, then drag from an
          output to an input to wire them together.
        </p>
      </div>
    </div>
  );
}

/** Top-centre: how to remove the selected nodes. */
export function SelectionHint({ nodes }: { nodes: number }) {
  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-divider bg-paper px-3 py-1 text-[12px] text-fg-muted shadow-sm">
      {nodes} node{nodes > 1 ? "s" : ""} selected · <Kbd>Delete</Kbd> to remove
    </div>
  );
}

/** Both ends of a wire, looked up in the graph; null if either is missing. */
export function wireEndsOf(
  nodes: NodeSpec[],
  wire: Pick<WireSpec, "source" | "sourceOutput" | "target" | "targetInput">,
): { from: WireEnd; to: WireEnd } | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const end = (
    node: NodeSpec | undefined,
    key: string,
    side: "inputs" | "outputs",
  ): WireEnd | null => {
    const port = node?.[side].find((p) => p.key === key);
    return node && port ? { node, port: port.name, kind: port.kind } : null;
  };
  const from = end(byId.get(wire.source), wire.sourceOutput, "outputs");
  const to = end(byId.get(wire.target), wire.targetInput, "inputs");
  return from && to ? { from, to } : null;
}
