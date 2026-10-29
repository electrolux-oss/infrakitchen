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

// Defaults suggested when a project overrides the global drift schedule
export const DEFAULT_DRIFT_INTERVAL_HOURS = 24;
export const DEFAULT_DRIFT_BATCH_SIZE = 20;
