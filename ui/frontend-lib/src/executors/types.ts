import { IntegrationShort } from "../integrations/types";
import { SecretShort } from "../secrets/types";
import { SourceCodeShort } from "../source_codes/types";
import { StorageShort } from "../storages/types";
import { UserShort } from "../users";

export interface ExecutorShort {
  id: string;
  name: string;
  source_code: SourceCodeShort;
  _entity_name: string;
}

export interface ExecutorResponse {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  state: string;
  status: string;
  description: string;
  command_args: string;
  runtime: string;
  revision_number: number;
  creator: UserShort | null;
  integration_ids: IntegrationShort[];
  secret_ids: SecretShort[];
  storage: StorageShort | null;
  source_code: SourceCodeShort | null;
  source_code_branch: string | null;
  source_code_version: string | null;
  source_code_folder: string;
  storage_path: string | null;
  labels: string[];
  _entity_name: string;
}

export interface ExecutorCreate {
  name: string;
  description: string;
  command_args: string;
  runtime: string;
  storage_id: string | null;
  source_code_id: string;
  source_code_branch?: string;
  source_code_version?: string;
  source_code_folder: string;
  integration_ids: string[];
  secret_ids: string[];
  storage_path: string | null;
  labels: string[];
}

export interface ExecutorUpdate {
  description: string;
  command_args: string;
  source_code_branch?: string;
  source_code_version?: string;
  source_code_folder: string;
  source_code_id: string;
  integration_ids: string[];
  secret_ids: string[];
  labels: string[];
}
