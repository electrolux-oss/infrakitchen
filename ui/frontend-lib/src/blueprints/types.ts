import { TemplateShort } from "../templates/types";
import { UserShort } from "../users";
import { WorkflowResponse } from "../workflows/types";

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
  workflows: WorkflowResponse[];
  created_at: string;
  updated_at: string;
  _entity_name: string;
}

// Re-export for convenience; blueprint pages use the full workflow shape.
export type { WorkflowResponse, WorkflowStepResponse } from "../workflows/types";
