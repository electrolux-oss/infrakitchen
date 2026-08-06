export interface DependencyTag {
  name: string;
  value: string;
  inherited_by_children: boolean;
}

export interface DependencyConfig {
  name: string;
  value: string;
  inherited_by_children: boolean;
}

export interface ProjectConfig {
  always_use_workspace: boolean;
  allow_unapproved_metadata_edits: ResourceUpdateApprovalBypassField[];
}

export type ResourceUpdateApprovalBypassField =
  | "name"
  | "description"
  | "source_code_version_id"
  | "integration_ids"
  | "secret_ids"
  | "variables"
  | "dependency_tags"
  | "dependency_config"
  | "labels"
  | "workspace_id"
  | "project_id"
  | "storage_id"
  | "storage_path";

export interface ProjectCreateRequest {
  name: string;
  description: string;
  workspaceId: string | null;
  configuration: ProjectConfig;
  dependencyTags: DependencyTag[];
  dependencyConfig: DependencyConfig[];
  labels: string[];
  owners: string[];
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
  workspaceId?: string | null;
  configuration?: ProjectConfig;
  dependencyTags?: DependencyTag[];
  dependencyConfig?: DependencyConfig[];
  labels?: string[];
  owners?: string[];
}
