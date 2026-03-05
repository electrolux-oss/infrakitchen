import { UserShort } from "../users";

export interface WiringRule {
  source_template_id: string;
  source_output: string;
  target_template_id: string;
  target_variable: string;
}

export interface WorkflowStepResponse {
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

export interface WorkflowResponse {
  id: string;
  blueprint_id: string;
  status: "pending" | "in_progress" | "done" | "error" | "cancelled";
  error_message: string | null;
  steps: WorkflowStepResponse[];
  wiring_snapshot: WiringRule[];
  variable_overrides: Record<string, any>;
  parent_overrides: Record<string, string[]>;
  source_code_version_overrides: Record<string, string>;
  integration_ids: string[];
  secret_ids: string[];
  creator: UserShort;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  _entity_name: string;
}
