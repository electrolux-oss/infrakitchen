import { createContext, useContext, useEffect, useMemo } from "react";

import {
  Handle,
  Node,
  NodeProps,
  Position,
  useUpdateNodeInternals,
} from "@xyflow/react";

import { NodeSpec } from "./graph";
import { NodeCard, RenderSocket, SocketDot } from "./NodeCard";

export interface WiringNodeData extends Record<string, unknown> {
  spec: NodeSpec;
  /** Port keys that have a wire. */
  wired: Set<string>;
  /** `wired` as a string, to tell cheaply when it changed. */
  wiredKey: string;
  /** Show every port instead of only the wired ones and the first few. */
  expanded: boolean;
}

export type WiringFlowNode = Node<WiringNodeData, "wiring">;

/** What a node can ask of the canvas. */
export interface WiringNodeActions {
  readOnly: boolean;
  removeNode: (nodeId: string) => void;
  toggleExpanded: (nodeId: string) => void;
  changeConstant: (
    constantId: string,
    patch: { name?: string; defaultValue?: string },
  ) => void;
}

export const WiringNodeActionsContext = createContext<WiringNodeActions>({
  readOnly: true,
  removeNode: () => undefined,
  toggleExpanded: () => undefined,
  changeConstant: () => undefined,
});

// The handle is only a hit area around the dot; NodeCard draws the dot
const HANDLE_STYLE = {
  display: "flex",
  minWidth: 0,
  minHeight: 0,
  border: 0,
  background: "transparent",
};

export function WiringNodeView({
  id,
  data,
  selected,
}: NodeProps<WiringFlowNode>) {
  const actions = useContext(WiringNodeActionsContext);
  const updateNodeInternals = useUpdateNodeInternals();
  const { spec, wired, wiredKey, expanded } = data;

  // Rows move when ports, wires or the expanded state change, sometimes
  // without the card changing size; measure the handles again so wires follow
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, spec, wiredKey, expanded, updateNodeInternals]);

  // React Flow re-renders a node on every drag frame (its position is a
  // prop); the card only changes with these, so React skips it otherwise
  const isSelected = Boolean(selected);
  return useMemo(() => {
    const renderSocket: RenderSocket = (side, key, kind) => (
      <Handle
        id={key}
        type={side === "input" ? "target" : "source"}
        position={side === "input" ? Position.Left : Position.Right}
        isConnectable={!actions.readOnly}
        style={HANDLE_STYLE}
      >
        <SocketDot kind={kind} />
      </Handle>
    );
    return (
      <NodeCard
        spec={spec}
        selected={isSelected}
        wired={wired}
        expanded={expanded}
        onToggleExpanded={() => actions.toggleExpanded(id)}
        onRemove={() => actions.removeNode(id)}
        onConstantChange={(patch) =>
          actions.changeConstant(spec.entityId, patch)
        }
        renderSocket={renderSocket}
        readOnly={actions.readOnly}
      />
    );
  }, [id, spec, isSelected, wired, expanded, actions]);
}
