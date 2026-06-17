import { WiringRule } from "../common/components/viewers/Wiring/types";
import { TemplateShort } from "../templates/types";
import { UserShort } from "../users";
import { WorkflowResponse } from "../workflows/types";

export type ConstantType = "string" | "number";

export interface ConstantBlock {
  id: string;
  name: string;
  type: ConstantType;
  defaultValue?: string;
}

/**
 * A template pinned onto the canvas as an external input (parent).
 * When using the blueprint the user selects an actual resource of this
 * template type.
 */
export interface ExternalTemplate {
  id: string; // template ID
  name: string; // template display name
  abstract?: boolean;
}

export interface BlueprintConfiguration {
  constants: ConstantBlock[];
  constant_wires: WiringRule[];
}

export interface BlueprintCreateRequest {
  name: string;
  description: string;
  templateIds: string[];
  externalTemplateIds: string[];
  wiring: WiringRule[];
  defaultVariables: Record<string, Record<string, any>>;
  configuration: Record<string, any>;
  labels: string[];
}

export interface BlueprintUpdateRequest {
  name?: string;
  description?: string;
  templateIds?: string[];
  externalTemplateIds?: string[];
  wiring?: WiringRule[];
  defaultVariables?: Record<string, Record<string, any>>;
  configuration?: Record<string, any>;
  labels?: string[];
}

export interface BlueprintResponse {
  id: string;
  name: string;
  description: string;
  templates: TemplateShort[];
  external_templates: TemplateShort[];
  wiring: WiringRule[];
  default_variables: Record<string, Record<string, any>>;
  configuration: Record<string, any>;
  labels: string[];
  status: "enabled" | "disabled";
  revision_number: number;
  workflows: WorkflowResponse[];
  created_at: string;
  updated_at: string;
  creator: UserShort;
  _entity_name: string;
}

export type BlueprintResponseOptional = Partial<BlueprintResponse>;

// Re-export for convenience; blueprint pages use the full workflow shape.
export type {
  WorkflowResponse,
  WorkflowStepResponse,
} from "../workflows/types";
