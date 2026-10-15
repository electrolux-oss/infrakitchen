import React from "react";

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

const tone = (name: string) => ({
  main: `var(--color-${name})`,
  light: `var(--color-${name}-light)`,
  contrastText: `var(--color-${name}-contrast)`,
});

/**
 * Canvas colours as CSS variable references. The canvas passes plain style
 * strings to React Flow, and `var(...)` values follow the light/dark switch
 * without re-rendering.
 */
export const CANVAS_PALETTE = {
  background: { paper: "var(--color-paper)", default: "var(--color-canvas)" },
  divider: "var(--color-divider)",
  text: { secondary: "var(--color-fg-muted)" },
  grey: { 500: "var(--color-grey-500)" },
  info: tone("info"),
  success: tone("success"),
  warning: tone("warning"),
  error: tone("error"),
  secondary: tone("secondary"),
};

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
