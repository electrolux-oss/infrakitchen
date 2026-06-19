import { GqlSourceCodeShort } from "../../source_codes/graphql";
import { GqlTemplateShort } from "../../templates/graphql";
import { GqlUserShort } from "../../users/graphql";

export interface GqlSourceCodeVersionShort {
  id: string;
  identifier: string;
  entityName: string;
  template: GqlTemplateShort;
  sourceCode: GqlSourceCodeShort;
  sourceCodeVersion: string | null;
  sourceCodeBranch: string | null;
  sourceCodeFolder: string;
}

export interface GqlSourceCodeVersion {
  id: string;
  identifier: string;
  entityName: string;
  templateId: string | null;
  template: GqlTemplateShort;
  sourceCodeId: string | null;
  sourceCode: GqlSourceCodeShort;
  sourceCodeVersion: string | null;
  sourceCodeBranch: string | null;
  sourceCodeFolder: string;
  variables: any[] | null;
  outputs: any[] | null;
  codeSnapshot: string | null;
  description: string;
  labels: string[] | null;
  resourcesCount: number | null;
  status: string;
  revisionNumber: number;
  creator: GqlUserShort | null;
  createdAt: string;
  updatedAt: string;
}

export type GqlSourceCodeVersionOptional = Partial<GqlSourceCodeVersion> &
  Pick<GqlSourceCodeVersionShort, "id" | "identifier" | "entityName">;

export interface GqlSourceConfig {
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
}

export interface GqlSourceOutputConfig {
  id: string;
  createdAt: string;
  updatedAt: string;
  index: number;
  sourceCodeVersionId: string;
  name: string;
  description: string;
}

export interface GqlSourceConfigTemplateReference {
  id: string;
  templateId: string;
  referenceTemplateId: string;
  inputConfigName: string;
  outputConfigName: string;
}

export interface GqlSourceOutputConfigTemplate {
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: string;
}
