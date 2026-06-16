import { SourceCodeShort } from "../source_codes/types";
import { TemplateShort } from "../templates/types";
import { UserShort } from "../users";

export enum RefType {
  BRANCH = "branch",
  TAG = "tag",
}

export interface SourceCodeVersionShort {
  id: string;
  identifier: string;
  sourceCodeVersion: string;
  sourceCodeBranch: string;
  sourceCodeFolder: string;
  template: TemplateShort;
  source_code: SourceCodeShort;
  _entity_name: string;
}

export interface SourceCodeVersionResponse extends SourceCodeVersionShort {
  createdAt: Date;
  updatedAt: Date;
  status: string;
  revisionNumber: number;
  labels: string[];
  creator: UserShort;
  template: TemplateShort;
  source_code: SourceCodeShort;
  sourceCodeVersion: string;
  sourceCodeBranch: string;
  sourceCodeFolder: string;
  variables: VariableInput[];
  outputs: VariableOutput[];
  description: string;
  resourcesCount: number;
  codeSnapshot: string | null;
}

export type SourceCodeVersionResponseOptional =
  Partial<SourceCodeVersionResponse>;

export interface SourceCodeVersionCreate {
  description: string;
  labels: string[];
  sourceCodeId: string;
  sourceCodeVersion?: string;
  sourceCodeBranch?: string;
  sourceCodeFolder: string;
  templateId: string;
}

export interface SourceCodeVersionUpdate {
  description: string;
  labels: string[];
}

// Configs
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

export interface SourceOutputConfigShort {
  id: string;
  index: number;
  name: string;
  description: string;
  sourceCodeVersionId: string;
}

export interface SourceConfigResponse extends Record<string, any> {
  createdAt: Date;
  updatedAt: Date;
  index: number;
  sourceCodeVersionId: string;
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
  validationRuleId?: string | null;
  validationRegex?: string;
  validationMinValue?: string | number | null;
  validationMaxValue?: string | number | null;
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
  templateId: string;
  referenceTemplateId: string | null;
  outputConfigName?: string | null;
  validationRuleId?: string | null;
  validationRegex?: string;
  validationMinValue?: string | number | null;
  validationMaxValue?: string | number | null;
  validationEnabled: boolean;
}

export interface SourceOutputConfigResponse extends Record<string, any> {
  id: string;
  index: number;
  name: string;
  description: string;
  sourceCodeVersionId: string;
}

export interface SourceOutputConfigTemplateResponse {
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  status: string;
}

export interface SourceConfigTemplateReferenceResponse {
  id: string;
  templateId: string;
  referenceTemplateId: string;
  inputConfigName: string;
  outputConfigName: string;
}
