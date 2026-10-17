import { Handle, Node, NodeProps, Position } from "@xyflow/react";

import { useConfig } from "../..";
import { LaunchIcon } from "../../../icons/material";
import { Link, useColorScheme } from "../../../ui";
import StatusChip from "../../StatusChip";
import { Entity } from "../entities/Entity";
import { TreeResponse } from "../tree/types";

export interface GraphNodeData extends Record<string, unknown> {
  entity_name: string;
  entity_id: string;
  item: TreeResponse;
  isRoot: boolean;
}

export type GraphNode = Node<GraphNodeData, "graphNode">;

/**
 * Graph node for the resource/template dependency graph. Mirrors the Tree
 * View's node content so both views stay visually consistent.
 *
 * Colors are picked explicitly from the resolved color scheme rather than
 * palette tokens because React Flow nodes render outside the app's
 * CSS-variable palette cascade (see WiringDiagram for the same pattern).
 */
export function GraphViewNode({ data }: NodeProps<GraphNode>) {
  const isDark = useColorScheme().resolvedMode === "dark";
  const { linkPrefix } = useConfig();
  const { entity_name, entity_id, item, isRoot } = data;

  const status = String(item.status || "").toLowerCase();
  const state = String(item.state || "").toLowerCase();

  const backgroundColor = isDark ? "#161b22" : "#ffffff";
  const borderColor = isDark ? "#3d444d" : "#d0d7de";
  const highlightColor = isDark ? "#58a6ff" : "#0969da";

  return (
    <div
      className="box-border flex w-[280px] max-w-[280px] min-w-[180px] cursor-grab items-start gap-2 rounded-surface px-3 py-2 active:cursor-grabbing"
      style={{
        backgroundColor,
        border: `1px solid ${isRoot ? highlightColor : borderColor}`,
        boxShadow: isRoot
          ? `0 0 0 2px ${highlightColor}33`
          : "0 1px 2px rgba(0, 0, 0, 0.1)",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ visibility: "hidden" }}
      />
      <div className="flex min-w-0 flex-auto overflow-hidden">
        <Entity
          entity={{
            id: entity_id,
            name: item.name,
            entityName: entity_name,
            template: item.templateName
              ? { name: item.templateName }
              : undefined,
          }}
          showLabel
          stacked
          noWrap
          linkClassName="nodrag min-w-0 text-body2"
        />
      </div>
      <div className="mt-0.5 ml-auto flex shrink-0 items-center gap-2">
        <StatusChip
          status={status}
          state={state}
          compact
          className="text-[15px]"
        />
        <Link
          href={`${linkPrefix}${entity_name}s/${entity_id}`}
          target="_blank"
          className="nodrag inline-flex"
          aria-label={`Open ${item.name} ${entity_name} in new tab`}
        >
          <LaunchIcon className="text-[15px] text-fg-muted" />
        </Link>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ visibility: "hidden" }}
      />
    </div>
  );
}
