import { useState } from "react";

import {
  ConnectionLineComponentProps,
  Edge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from "@xyflow/react";

import {
  INHERITED_DASH,
  PORT_COLOR,
  portKindOfKey,
  WIRE_COLOR,
  WireFocus,
  wireLabel,
  wireStroke,
  wireTypeOf,
} from "./graph";
import { WiringRule } from "./types";

export interface WiringEdgeData extends Record<string, unknown> {
  rule: WiringRule;
  /** Shown only: filled from an ancestor that is not on the canvas. */
  inherited: boolean;
  /** Set by source code configuration; cannot be removed on the canvas. */
  locked: boolean;
  /** Overrides the colour from the wire type. */
  color?: string;
  /** How the wire looks while nodes are selected. */
  focus: WireFocus;
  /** Title of the source node, for the label of inherited wires. */
  sourceTitle: string;
}

export type WiringFlowEdge = Edge<WiringEdgeData, "wiring">;

/** Wire between two ports, coloured by what it carries. */
export function WiringEdgeView({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  data,
  selected,
}: EdgeProps<WiringFlowEdge>) {
  const [hovered, setHovered] = useState(false);
  if (!data) return null;

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { inherited, locked, rule } = data;
  const color =
    data.color ??
    WIRE_COLOR[
      wireTypeOf({
        sourceOutput: String(sourceHandleId ?? ""),
        inherited,
        fromSource: locked,
      })
    ];
  const label = wireLabel(rule.source_output, rule.target_variable, {
    inheritedFrom: inherited ? data.sourceTitle : undefined,
    fromSource: locked,
  });
  const stroke = wireStroke({ selected, focus: data.focus, inherited });

  return (
    <>
      <g
        className="group/wire cursor-pointer"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        data-testid="wiring-connection"
      >
        {/* Wide transparent stroke so thin wires are easy to click */}
        <path d={path} fill="none" stroke="transparent" strokeWidth={14} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={stroke.width}
          strokeOpacity={stroke.opacity}
          strokeDasharray={inherited ? INHERITED_DASH : undefined}
          className="transition-[stroke-width,stroke-opacity] group-hover/wire:[stroke-opacity:1]"
        />
      </g>
      {/* Mounted only when shown: a label per wire is a lot of DOM */}
      {(hovered || selected) && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute flex w-60 justify-center"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <span
              className="max-w-full truncate rounded-full border bg-paper px-2 py-0.5 font-mono text-[11px] leading-4 text-fg shadow-sm"
              style={{ borderColor: color }}
            >
              {label}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/** Preview wire drawn while dragging from a port. */
export function WiringConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  fromHandle,
}: ConnectionLineComponentProps) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });
  return (
    <path
      d={path}
      fill="none"
      stroke={PORT_COLOR[portKindOfKey(fromHandle.id ?? "")]}
      strokeWidth={2}
      strokeDasharray="6 4"
    />
  );
}
