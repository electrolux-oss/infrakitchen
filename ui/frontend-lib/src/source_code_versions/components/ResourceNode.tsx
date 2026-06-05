import type { CSSProperties } from "react";

import { Box, Chip, Typography, useTheme } from "@mui/material";
import { Handle, Node, NodeProps, Position } from "@xyflow/react";

const PROVIDER_COLORS: Record<string, string> = {
  aws: "#FF9900",
  azurerm: "#0078D4",
  google: "#4285F4",
  helm: "#0F1689",
  kubernetes: "#326CE5",
  kubectl: "#326CE5",
  random: "#546E7A",
  null: "#546E7A",
  module: "#6B46C1",
  postgresql: "#336791",
};

export function providerColor(p: string): string {
  return PROVIDER_COLORS[p.toLowerCase()] ?? "#455A64";
}

export interface ResourceNodeData {
  headerLabel: string;
  subLabel: string;
  color: string;
  isConditional?: boolean;
  hasIncoming?: boolean;
  hasOutgoing?: boolean;
  [key: string]: unknown;
}

export type ResourceDiagramNode = Node<ResourceNodeData>;

function handleStyle(color: string, bg: string, size = 10): CSSProperties {
  return {
    position: "relative",
    transform: "none",
    top: "auto",
    left: "auto",
    right: "auto",
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    background: color,
    border: `2px solid ${bg}`,
    borderRadius: "50%",
    flexShrink: 0,
  };
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export function ResourceNode({ data }: NodeProps<ResourceDiagramNode>) {
  const theme = useTheme();
  const bg = theme.palette.background.paper;
  const headerBg = data.color;
  const headerText = isLight(headerBg) ? "#000" : "#fff";

  return (
    <Box
      sx={{
        background: bg,
        border: `2px solid ${theme.palette.divider}`,
        borderRadius: 2,
        cursor: "pointer",
        minWidth: 200,
        maxWidth: 280,
        boxShadow: theme.shadows[2],
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: headerBg,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            color: headerText,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {data.headerLabel}
        </Typography>
        {data.isConditional && (
          <Chip
            label="optional"
            size="small"
            sx={{
              fontWeight: 700,
              height: 18,
              fontSize: 10,
              bgcolor: "transparent",
              border: `1px solid ${headerText}`,
              color: headerText,
              "& .MuiChip-label": { px: 0.75, color: headerText },
            }}
          />
        )}
      </Box>

      {/* Body: sub-label + handles */}
      <Box sx={{ px: 1.5, pt: data.subLabel ? 0.75 : 0, pb: 1 }}>
        {data.subLabel && (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: theme.palette.text.secondary,
              fontSize: "0.66rem",
              lineHeight: 1.3,
              wordBreak: "break-all",
              mb: 0.75,
            }}
          >
            {data.subLabel}
          </Typography>
        )}

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mt: 0.25,
          }}
        >
          {data.hasIncoming ? (
            <Handle
              type="target"
              position={Position.Left}
              id="in"
              style={handleStyle(theme.palette.info.main, bg)}
            />
          ) : (
            <Box sx={{ width: 10, height: 10 }} />
          )}
          {data.hasOutgoing ? (
            <Handle
              type="source"
              position={Position.Right}
              id="out"
              style={handleStyle(theme.palette.success.main, bg)}
            />
          ) : (
            <Box sx={{ width: 10, height: 10 }} />
          )}
        </Box>
      </Box>
    </Box>
  );
}
