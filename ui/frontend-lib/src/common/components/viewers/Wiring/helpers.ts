import React from "react";

import { useTheme } from "@mui/material";
import { Node } from "@xyflow/react";

import { ENTITY_STATUS } from "../../../../utils";

export interface DiagramNodeData {
  label: string;
  templateId: string;
  outputs: string[];
  inputs: string[];
  kind: "template" | "external" | "constant";
  order?: number;
  onRemove?: (templateId: string) => void;
  constantId?: string;
  name?: string;
  onUpdate?: (constantId: string, name: string) => void;
  onDefaultValueUpdate?: (constantId: string, defaultValue: string) => void;
  constantType?: string;
  defaultValue?: string;
  status?: ENTITY_STATUS;
  errorMessage?: string | null;
  resourceId?: string | null;
  resourceName?: string;
  stepPosition?: number;
  [key: string]: unknown;
}

export type DiagramNode = Node<DiagramNodeData>;

/**
 * Explicit blue for node headers, matching `GraphViewNode`. The app palette is
 * monochrome, so a palette-driven header would read as a black bar.
 */
export const NODE_ACCENT = {
  light: "#0969da",
  dark: "#1f6feb",
} as const;

/**
 * Mode-aware palette. Under `cssVariables`, `theme.palette` holds the light
 * scheme's literal values; only `theme.vars` follows the active scheme. `sx`
 * handles this itself, but the canvas passes plain strings to React Flow, so
 * canvas colours must come from here.
 */
export function useCanvasPalette() {
  const theme = useTheme();
  return (theme.vars ?? theme).palette;
}

export function makeHandleStyle(
  color: string,
  bgPaper: string,
  size = 10,
): React.CSSProperties {
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
    border: `2px solid ${bgPaper}`,
    borderRadius: "50%",
    flexShrink: 0,
  };
}
