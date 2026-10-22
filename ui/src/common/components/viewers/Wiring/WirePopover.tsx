import { useLayoutEffect, useRef, useState } from "react";

import { useStore } from "@xyflow/react";

import {
  HeroArrowDownIcon,
  HeroTrashIcon,
  HeroXMarkIcon,
} from "../../../../icons";
import { Button, Label, Tooltip } from "../../../../ui";
import { cn } from "../../../../utils/cn";

import { NodeSpec, PORT_COLOR, PortKind, WIRE_COLOR } from "./graph";
import { KIND_META, NodeIcon, nodeKindLabel } from "./NodeCard";

const PORT_LABEL: Record<PortKind, string> = {
  input: "Input",
  output: "Output",
  config: "Dependency config",
};

export interface WireEnd {
  node: NodeSpec;
  port: string;
  kind: PortKind;
}

const WIDTH = 304;
const GAP = 12;

/** Card shown next to a clicked wire: what it connects, and Remove. */
export function WirePopover({
  from,
  to,
  at,
  onRemove,
  onClose,
  locked,
  inherited,
  readOnly,
}: {
  from: WireEnd;
  to: WireEnd;
  /** Click point on the canvas. Must sit inside a `ReactFlowProvider`. */
  at: { x: number; y: number };
  onRemove: () => void;
  onClose: () => void;
  /** Set by source code configuration: the wire cannot be removed. */
  locked?: boolean;
  /** From an ancestor that is not on the canvas; shown only. */
  inherited?: boolean;
  /** View only: no Remove button. */
  readOnly?: boolean;
}) {
  // Follows the view from the store: panning re-renders only the popover
  const [tx, ty, k] = useStore((s) => s.transform);
  const bounds = {
    width: useStore((s) => s.width),
    height: useStore((s) => s.height),
  };
  const anchor = { x: at.x * k + tx, y: at.y * k + ty };
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(240);
  useLayoutEffect(() => {
    if (ref.current) setHeight(ref.current.offsetHeight);
  }, [from, to]);

  // Open below-right of the click, flipping when it would leave the canvas
  const fitsRight = anchor.x + GAP + WIDTH <= bounds.width - 8;
  const fitsBelow = anchor.y + GAP + height <= bounds.height - 8;
  const left = fitsRight ? anchor.x + GAP : anchor.x - GAP - WIDTH;
  const top = fitsBelow ? anchor.y + GAP : anchor.y - GAP - height;
  const clamp = (v: number, max: number) => Math.max(8, Math.min(v, max));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Wire"
      className="absolute z-20 rounded-xl border border-divider bg-paper text-fg shadow-[0_4px_24px_rgb(0_0_0/0.12)]"
      style={{
        width: WIDTH,
        left: clamp(left, bounds.width - WIDTH - 8),
        top: clamp(top, bounds.height - height - 8),
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 py-1.5 pr-1.5 pl-4">
        <h3 className="m-0 text-[13px] font-semibold">Wire</h3>
        <Tooltip title="Close">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <HeroXMarkIcon className="text-[16px]" />
          </button>
        </Tooltip>
      </div>

      <div className="border-t border-divider px-3 py-3">
        <End title="From" end={from} />
        <div className="-mt-2 grid h-8 w-8 place-items-center text-fg-disabled">
          <HeroArrowDownIcon className="text-[14px]" />
        </div>
        <End title="To" end={to} />
      </div>

      {inherited ? (
        <div className="flex items-start gap-2 border-t border-divider px-3 py-2.5 text-[12px] text-fg-muted">
          <span
            className="mt-1.5 h-0.5 w-3 shrink-0 rounded-full"
            style={{ background: WIRE_COLOR.inherited }}
          />
          <span>
            <span className="font-medium text-fg">{from.node.title}</span> is
            not part of this blueprint
            {from.node.note ? ` (${from.node.note.toLowerCase()})` : ""}. When
            the blueprint runs,{" "}
            <span className="font-medium text-fg">{to.node.title}</span> gets{" "}
            <span className="font-mono text-fg">{to.port}</span> from the{" "}
            {from.node.title} resource above it in the parent chain, as its
            source code configuration asks.
          </span>
        </div>
      ) : locked ? (
        <div className="flex items-start gap-2 border-t border-divider px-3 py-2.5 text-[12px] text-fg-muted">
          <span
            className="mt-1.5 h-0.5 w-3 shrink-0 rounded-full"
            style={{ background: WIRE_COLOR.source }}
          />
          <span>
            Set by the source code configuration of{" "}
            <span className="font-medium text-fg">{to.node.title}</span>, so it
            cannot be removed here.
          </span>
        </div>
      ) : readOnly ? null : (
        <div className="flex items-center justify-between gap-2 border-t border-divider px-3 py-2">
          <span className="text-[11px] text-fg-muted">
            or press{" "}
            <kbd className="rounded border border-divider bg-canvas px-1 font-sans text-[11px] text-fg">
              Delete
            </kbd>
          </span>
          <Button
            size="small"
            startIcon={<HeroTrashIcon className="text-[16px]" />}
            onClick={onRemove}
            className="text-error"
          >
            Remove wire
          </Button>
        </div>
      )}
    </div>
  );
}

function End({ title, end }: { title: string; end: WireEnd }) {
  const { node, port, kind } = end;
  return (
    <div className="flex items-start gap-2.5">
      <div
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          KIND_META[node.kind].tile,
        )}
      >
        <NodeIcon spec={node} className="text-[16px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="w-8 shrink-0 text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
            {title}
          </span>
          <span className="truncate text-[13px] leading-5 font-semibold">
            {node.title || "Unnamed"}
          </span>
          <Label
            size="small"
            label={node.kind === "constant" ? "Constant" : nodeKindLabel(node)}
          />
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px]">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: PORT_COLOR[kind] }}
          />
          <span className="min-w-0 truncate font-mono">{port}</span>
          <span className="shrink-0 text-fg-muted">· {PORT_LABEL[kind]}</span>
        </div>
      </div>
    </div>
  );
}
