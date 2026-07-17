import { SourceOutputConfigShort } from "../source_code_versions/types";

export interface VariableInput {
  name: string;
  value: any;
  sensitive: boolean;
  type: string;
  description: string;
}

export interface VariableOutput {
  name: string;
  value: any;
  sensitive: boolean;
  description: string;
}

export interface DependencyVariable {
  name: string;
  value: string;
  inherited_by_children: boolean;
}

export interface ResourceCreate {
  name: string;
  description: string;
  templateId: string;
  storageId: string | null;
  sourceCodeVersionId: string | null;
  integrationIds: string[];
  secretIds: string[];
  storagePath: string | null;
  variables: ResourceVariableSchema[];
  outputs: object[];
  dependencyTags: object[];
  dependencyConfig: object[];
  labels: string[];
  parents: string[];
  workspaceId: string | null;
  projectId: string | null;
}

export interface ResourceVariableSchema {
  name: string;
  type: string;
  description: string;
  options: string[];
  required: boolean;
  restricted: boolean;
  sensitive: boolean;
  frozen: boolean;
  unique: boolean;
  value: any | null;
  index: number;
  reference?: SourceOutputConfigShort | null;
}
