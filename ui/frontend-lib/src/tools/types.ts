import { GqlUserShort } from "../users/graphql";

export type ToolName = "opentofu" | "terraform";

export interface ToolShort {
  id: string;
  name: ToolName;
  version: string;
  os: string;
  arch: string;
}

export interface Tool extends ToolShort {
  executable: string;
  sourceUrl: string;
  sha256: string;
  size: number;
  status: string;
  errorMessage: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
  creator?: GqlUserShort | null;
}

export interface ToolDetail extends Tool {
  resourcesCount: number;
  executorsCount: number;
}

export const TOOL_NAMES: { value: ToolName; label: string }[] = [
  { value: "opentofu", label: "OpenTofu" },
  { value: "terraform", label: "Terraform" },
];

export const toolStatus = (tool: Pick<Tool, "status">): string =>
  String(tool.status || "").toLowerCase();

export const toolLabel = (tool: ToolShort): string => {
  const name =
    TOOL_NAMES.find((item) => item.value === tool.name)?.label || tool.name;
  return `${name} ${tool.version} (${tool.os}/${tool.arch})`;
};

/** Label of the tool used when an entity doesn't select one. */
export const defaultToolLabel = (defaultTool?: ToolShort | null): string =>
  defaultTool
    ? `Global default: ${toolLabel(defaultTool)}`
    : "Global default: tofu installed on the worker";

export const formatToolSize = (size?: number | null): string =>
  size ? `${(size / 1024 / 1024).toFixed(1)} MB` : "—";
