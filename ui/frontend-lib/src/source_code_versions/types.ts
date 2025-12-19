import { SourceCodeShort } from "../source_codes/types";
import { TemplateShort } from "../templates/types";
import { UserShort } from "../users";

export interface RefFolders {
  ref: string;
  folders: string[];
}

export interface SourceCodeVersionShort {
  id: string;
  identifier: string;
  source_code_version: string;
  source_code_branch: string;
  source_code_folder: string;
  template: TemplateShort;
  _entity_name: string;
}

export interface SourceCodeVersionResponse extends SourceCodeVersionShort {
  created_at: Date;
  updated_at: Date;
  status: string;
  state: string;
  revision_number: number;
  labels: string[];
  creator: UserShort;
  template: TemplateShort;
  source_code: SourceCodeShort;
  source_code_version: string;
  source_code_branch: string;
  source_code_folder: string;
  variables: VariableInput[];
  outputs: VariableOutput[];
  description: string;
}

export interface SourceCodeVersionCreate {
  description: string;
  labels: string[];
  source_code_id: string;
  source_code_version?: string;
  source_code_branch?: string;
  source_code_folder: string;
  template_id: string;
}

export interface SourceCodeVersionUpdate {
  description: string;
  labels: string[];
}

export interface VariableInput {
  name: string;
  type: string;
  original_type: string;
  description: string;
  required: boolean;
  default: any;
  sensitive: boolean;
}

export interface VariableOutput {
  name: string;
  value: any;
  description: string;
}

// Configs
export interface SourceOutputConfigShort {
  id: string;
  index: number;
  name: string;
  description: string;
  source_code_version_id: string;
}

export interface SourceConfigResponse extends Record<string, any> {
  created_at: Date;
  updated_at: Date;
  index: number;
  source_code_version_id: string;
  required: boolean;
  default: any;
  frozen: boolean;
  unique: boolean;
  restricted: boolean;
  sensitive: boolean;
  name: string;
  description: string;
  type: string;
  options: string[];
}

export interface SourceConfigUpdate extends Record<string, any> {
  required: boolean;
  default: any;
  frozen: boolean;
  unique: boolean;
  restricted: boolean;
  options: string[];
}

export interface SourceConfigUpdateWithId extends SourceConfigUpdate {
  id: string;
  template_id: string;
  reference_template_id: string | null;
}

export interface SourceOutputConfigResponse extends Record<string, any> {
  id: string;
  index: number;
  name: string;
  description: string;
  source_code_version_id: string;
}

export interface SourceOutputConfigTemplateResponse {
  name: string;
  description: string;
  created_at: Date;
  updated_at: Date;
  status: string;
}

export interface SourceConfigTemplateReferenceResponse {
  id: string;
  template_id: string;
  reference_template_id: string;
  input_config_name: string;
  output_config_name: string;
}
