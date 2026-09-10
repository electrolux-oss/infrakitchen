import { Launch } from "@mui/icons-material";
import { Box, Link, useColorScheme } from "@mui/material";
import { Handle, Node, NodeProps, Position } from "@xyflow/react";

import { useConfig } from "../..";
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
 * Read-only graph node for the resource/template dependency graph. Mirrors
 * the Tree View's node content (Entity + status + launch link) so both views
 * stay visually consistent.
 *
 * Colors are picked explicitly from `useColorScheme()` rather than theme
 * tokens (`background.paper`/`divider`) because React Flow nodes render
 * outside the app's CSS-variable palette cascade, and `theme.palette.mode`
 * from `useTheme()` doesn't update on dark-mode toggle when `cssVariables`
 * is enabled (see WiringDiagram for the same pattern).
 */
export function GraphViewNode({ data }: NodeProps<GraphNode>) {
  const { mode } = useColorScheme();
  const isDark = mode === "dark";
  const { linkPrefix } = useConfig();
  const { entity_name, entity_id, item, isRoot } = data;

  const status = String(item.status || "").toLowerCase();
  const state = String(item.state || "").toLowerCase();

  const backgroundColor = isDark ? "#161b22" : "#ffffff";
  const borderColor = isDark ? "#3d444d" : "#d0d7de";
  const highlightColor = isDark ? "#58a6ff" : "#0969da";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1,
        px: 1.5,
        py: 1,
        minWidth: 180,
        maxWidth: 280,
        backgroundColor,
        border: `1px solid ${isRoot ? highlightColor : borderColor}`,
        borderRadius: "var(--template-surface-radius)",
        boxShadow: isRoot
          ? `0 0 0 2px ${highlightColor}33`
          : "0 1px 2px rgba(0, 0, 0, 0.1)",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ visibility: "hidden" }}
      />
      <Box className="nodrag" sx={{ minWidth: 0, display: "flex" }}>
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
          sx={{ minWidth: 0, typography: "body2" }}
        />
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mt: 0.25,
          ml: "auto",
        }}
      >
        <StatusChip
          status={status}
          state={state}
          compact
          sx={{ fontSize: 15 }}
        />
        <Link
          href={`${linkPrefix}${entity_name}s/${entity_id}`}
          target="_blank"
          className="nodrag"
          sx={{ display: "inline-flex" }}
          aria-label={`Open ${item.name} ${entity_name} in new tab`}
        >
          <Launch sx={{ fontSize: 15, color: "text.secondary" }} />
        </Link>
      </Box>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ visibility: "hidden" }}
      />
    </Box>
  );
}
