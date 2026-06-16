import { ENTITY_STATUS } from "../../../../utils";

export interface WiringRule {
  source_template_id: string;
  source_output: string;
  target_template_id: string;
  target_variable: string;
}

export interface GenericTemplate {
  id: string;
  name: string;
  abstract: boolean;
  cloudResourceTypes?: string[];
  _entity_name: string;
}

export interface GenericStep {
  id: string;
  template_id: string;
  template: GenericTemplate | null;
  resource_id: string | null;
  resource: Record<string, any> | null;
  position: number;
  status: ENTITY_STATUS;
  error_message: string | null;
  resolved_variables: Record<string, any>;
  started_at: string | null;
  completed_at: string | null;
}
