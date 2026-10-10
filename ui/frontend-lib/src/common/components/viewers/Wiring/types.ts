export type WiringSourceType = "output" | "dependency_config";
export type WiringTargetType = "variable" | "dependency_config";

export interface WiringRule {
  source_template_id: string;
  source_output: string;
  target_template_id: string;
  target_variable: string;
  /** Source is an output (default) or a required dependency config of the source template */
  source_type?: WiringSourceType;
  /** Target is an input variable (default) or a required dependency config of the target template */
  target_type?: WiringTargetType;
}

export interface GenericTemplate {
  id: string;
  name: string;
  abstract: boolean;
  entityName: string;
  cloudResourceTypes: string[] | null;
}

export interface GenericStep {
  id: string;
  template_id?: string;
  template: GenericTemplate | null;
  resource_id?: string | null;
  resource: Record<string, any> | null;
  position: number;
  status: string;
  error_message: string | null;
  resolved_variables?: Record<string, any> | null;
  started_at: string | null;
  completed_at: string | null;
}
