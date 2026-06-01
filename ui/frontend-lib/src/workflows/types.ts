import { WiringRule } from "../common/components/viewers/Wiring/types";
import { IntegrationShort } from "../integrations/types";
import { ResourceShort } from "../resources/types";
import { SecretShort } from "../secrets/types";
import { SourceCodeVersionShort } from "../source_code_versions/types";
import { TemplateShort } from "../templates/types";
import { UserShort } from "../users";
import { ENTITY_STATUS } from "../utils";

export interface WorkflowStepResponse {
  id: string;
  template_id: string;
  template: TemplateShort | null;
  resource_id: string | null;
  resource: ResourceShort | null;
  position: number;
  status: ENTITY_STATUS;
  error_message: string | null;
  resolved_variables: Record<string, any>;
  parent_resource_ids: ResourceShort[] & {
    template?: TemplateShort;
  };
  integration_ids: IntegrationShort[];
  secret_ids: SecretShort[];
  source_code_version_id: string | null;
  source_code_version: SourceCodeVersionShort | null;
  storage_id: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkflowResponse {
  id: string;
  action: "create" | "destroy";
  status: ENTITY_STATUS;
  error_message: string | null;
  steps: WorkflowStepResponse[];
  wiring_snapshot: WiringRule[];
  creator: UserShort;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  _entity_name: string;
}

export type WorkflowResponseOptional = Partial<WorkflowResponse>;
