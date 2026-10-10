import React from "react";

import { useTheme } from "@mui/material";
import { Node } from "@xyflow/react";

import { ENTITY_STATUS } from "../../../../utils";

import { WiringSourceType, WiringTargetType } from "./types";

export interface DiagramNodeData {
  label: string;
  templateId: string;
  outputs: string[];
  inputs: string[];
  configs?: string[];
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

const CONFIG_SOURCE_PREFIX = "config-out-";
const CONFIG_TARGET_PREFIX = "config-in-";

/** Handle ids of wire endpoints; dependency config ports are distinct from outputs and inputs. */
export function sourceHandleId(
  type: WiringSourceType | undefined,
  name: string,
) {
  return type === "dependency_config"
    ? `${CONFIG_SOURCE_PREFIX}${name}`
    : `output-${name}`;
}

export function targetHandleId(
  type: WiringTargetType | undefined,
  name: string,
) {
  return type === "dependency_config"
    ? `${CONFIG_TARGET_PREFIX}${name}`
    : `input-${name}`;
}

export function parseSourceHandle(handle: string): {
  type: WiringSourceType;
  name: string;
} {
  return handle.startsWith(CONFIG_SOURCE_PREFIX)
    ? {
        type: "dependency_config",
        name: handle.slice(CONFIG_SOURCE_PREFIX.length),
      }
    : { type: "output", name: handle.replace(/^output-/, "") };
}

export function parseTargetHandle(handle: string): {
  type: WiringTargetType;
  name: string;
} {
  return handle.startsWith(CONFIG_TARGET_PREFIX)
    ? {
        type: "dependency_config",
        name: handle.slice(CONFIG_TARGET_PREFIX.length),
      }
    : { type: "variable", name: handle.replace(/^input-/, "") };
}

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
