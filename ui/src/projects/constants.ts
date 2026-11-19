import { ResourceUpdateApprovalBypassField } from "./types";

export const RESOURCE_UPDATE_APPROVAL_BYPASS_FIELD_OPTIONS: Array<{
  value: ResourceUpdateApprovalBypassField;
  label: string;
}> = [
  { value: "name", label: "Name" },
  { value: "description", label: "Description" },
  { value: "source_code_version_id", label: "Source Code Version" },
  { value: "integration_ids", label: "Integrations" },
  { value: "secret_ids", label: "Secrets" },
  { value: "variables", label: "Variables" },
  { value: "dependency_tags", label: "Dependency Tags" },
  { value: "dependency_config", label: "Dependency Config" },
  { value: "labels", label: "Labels" },
  { value: "workspace_id", label: "Workspace" },
  { value: "project_id", label: "Project" },
  { value: "storage_id", label: "Storage" },
  { value: "storage_path", label: "Storage Path" },
];

// Project drift detection: follow the global setting, or override it either way
export type DriftDetectionMode = "inherit" | "on" | "off";

export const DRIFT_DETECTION_OPTIONS: Array<{
  value: DriftDetectionMode;
  label: string;
}> = [
  { value: "inherit", label: "Global setting" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

export const toDriftDetectionMode = (
  value: boolean | null | undefined,
): DriftDetectionMode =>
  value === true ? "on" : value === false ? "off" : "inherit";

export const fromDriftDetectionMode = (
  mode: DriftDetectionMode,
): boolean | null => (mode === "on" ? true : mode === "off" ? false : null);
