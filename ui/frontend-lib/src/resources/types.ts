import { IntegrationShort } from "../integrations/types";
import { SecretShort } from "../secrets/types";
import {
  SourceCodeVersionShort,
  SourceOutputConfigShort,
} from "../source_codes/types";
import { StorageShort } from "../storages/types";
import { TemplateShort } from "../templates/types";
import { UserShort } from "../users";
import { WorkspaceShort } from "../workspaces/types";

export interface ResourceShort {
  id: string;
  name: string;
  template: TemplateShort;
  _entity_name: string;
}

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
}

export interface DependencyVariable {
  name: string;
  value: string;
  inherited_by_children: boolean;
}

export interface ResourceResponse {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  state: string;
  status: string;
  description: string;
  abstract: boolean;
  revision_number: number;
  creator: UserShort | null;
  template: TemplateShort;
  integration_ids: IntegrationShort[];
  secret_ids: SecretShort[];
  storage: StorageShort | null;
  source_code_version: SourceCodeVersionShort | null;
  storage_path: string | null;
  variables: VariableInput[];
  outputs: VariableOutput[];
  dependency_tags: DependencyVariable[];
  dependency_config: DependencyVariable[];
  parents: ResourceShort[];
  children: ResourceShort[];
  labels: string[];
  workspace: WorkspaceShort | null;
  _entity_name: string;
}

export interface ResourceCreate {
  name: string;
  description: string;
  template_id: string;
  storage_id: string | null;
  source_code_version_id: string | null;
  integration_ids: string[];
  secret_ids: string[];
  storage_path: string | null;
  variables: ResourceVariableSchema[];
  outputs: object[];
  dependency_tags: object[];
  dependency_config: object[];
  labels: string[];
  parents: string[];
  workspace_id: string | null;
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
  reference: SourceOutputConfigShort | null;
}

export interface ResourceUpdate {
  name: string;
  description: string;
  source_code_version_id: string | null;
  integration_ids: string[];
  secret_ids: string[];
  variables: ResourceVariableSchema[];
  dependency_tags: object[];
  dependency_config: object[];
  labels: string[];
  workspace_id: string | null;
}

export interface ResourceTempStateResponse {
  resource_id: string;
  value: Record<string, any>;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}
