export enum RefType {
  BRANCH = "branch",
  TAG = "tag",
}

export interface SourceCodeVersionCreate {
  description: string;
  labels: string[];
  sourceCodeId: string;
  sourceCodeVersion?: string;
  sourceCodeBranch?: string;
  sourceCodeFolder: string;
  templateId: string;
}

// Configs
export interface SourceOutputConfigShort {
  id: string;
  index: number;
  name: string;
  description: string;
  sourceCodeVersionId: string;
}

export interface SourceConfigResponse extends Record<string, any> {
  id: string;
  createdAt: string;
  updatedAt: string;
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

export interface SourceOutputConfigTemplateResponse {
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: string;
}

export interface SourceConfigTemplateReferenceResponse {
  id: string;
  templateId: string;
  referenceTemplateId: string;
  inputConfigName: string;
  outputConfigName: string;
}
