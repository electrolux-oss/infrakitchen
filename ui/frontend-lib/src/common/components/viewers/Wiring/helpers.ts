import React from "react";

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
