import { TemplateShort } from "../templates/types";
import { UserShort } from "../users";

export interface WiringRule {
  source_template_id: string;
  source_output: string;
  target_template_id: string;
  target_variable: string;
}

export interface BlueprintCreateRequest {
  name: string;
  description: string;
  template_ids: string[];
  wiring: WiringRule[];
  default_variables: Record<string, Record<string, any>>;
  configuration: Record<string, any>;
  labels: string[];
}

export interface BlueprintUpdateRequest {
  name?: string;
  description?: string;
  template_ids?: string[];
  wiring?: WiringRule[];
  default_variables?: Record<string, Record<string, any>>;
  configuration?: Record<string, any>;
  labels?: string[];
}

export interface BlueprintResponse {
  id: string;
  name: string;
  description: string;
  templates: TemplateShort[];
  wiring: WiringRule[];
  default_variables: Record<string, Record<string, any>>;
  configuration: Record<string, any>;
  labels: string[];
  status: "enabled" | "disabled";
  revision_number: number;
  created_by: UserShort | string;
  workflows: BlueprintExecutionResponse[];
  created_at: string;
  updated_at: string;
  _entity_name: string;
}

export interface BlueprintExecuteRequest {
  variable_overrides: Record<string, Record<string, any>>;
  workspace_id?: string;
  name_prefix?: string;
  integration_ids?: string[];
  storage_id?: string | null;
  secret_ids?: string[];
  source_code_version_overrides?: Record<string, string>;
  parent_overrides?: Record<string, string[]>;
}

export interface ExecutionStepResponse {
  id: string;
  template_id: string;
  resource_id: string | null;
  position: number;
  status: "pending" | "in_progress" | "done" | "error" | "cancelled";
  error_message: string | null;
  resolved_variables: Record<string, any>;
  parent_resource_ids: string[];
  integration_ids: string[];
  secret_ids: string[];
  source_code_version_id: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface BlueprintExecutionResponse {
  id: string;
  status: "pending" | "in_progress" | "done" | "error" | "cancelled";
  error_message: string | null;
  steps: ExecutionStepResponse[];
  wiring_snapshot: WiringRule[];
  variable_overrides: Record<string, any>;
  created_by: UserShort | string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  _entity_name?: string;
}
