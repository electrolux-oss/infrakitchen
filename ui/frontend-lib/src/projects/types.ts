import { PROJECT_STATUS } from "./constants";

export type ProjectStatus =
  (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

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
}

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
