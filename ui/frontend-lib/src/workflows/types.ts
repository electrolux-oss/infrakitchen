import { BlueprintResponse } from "../blueprints/types";
import { IntegrationShort } from "../integrations/types";
import { ResourceShort } from "../resources/types";
import { SecretShort } from "../secrets/types";
import { SourceCodeVersionShort } from "../source_codes/types";
import { TemplateShort } from "../templates/types";
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
  template: TemplateShort | null;
  resource_id: string | null;
  resource: ResourceShort | null;
  position: number;
  status: "pending" | "in_progress" | "done" | "error" | "cancelled";
  error_message: string | null;
  resolved_variables: Record<string, any>;
  parent_resource_ids: string[];
  parent_resources: ResourceShort[];
  integration_ids: IntegrationShort[];
  secret_ids: SecretShort[];
  source_code_version_id: string | null;
  source_code_version: SourceCodeVersionShort | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkflowResponse {
  id: string;
  blueprint_id: string;
  blueprint: BlueprintResponse | null;
  status: "pending" | "in_progress" | "done" | "error" | "cancelled";
  error_message: string | null;
  steps: WorkflowStepResponse[];
  wiring_snapshot: WiringRule[];
  variable_overrides: Record<string, any>;
  parent_overrides: Record<string, string[]>;
  source_code_version_overrides: Record<string, string>;
  integration_ids: IntegrationShort[];
  secret_ids: SecretShort[];
  creator: UserShort;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  _entity_name: string;
}
