import { WiringRule } from "../common/components/viewers/Wiring/types";

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
