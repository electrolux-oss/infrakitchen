import { IntegrationShort } from "../integrations/types";
import { UserShort } from "../users";

export interface RefFolders {
  ref: string;
  folders: string[];
}

export interface SourceCodeShort {
  id: string;
  identifier: string;
  source_code_url: string;
  source_code_provider: string;
  source_code_language: string;
  _entity_name: string;
}

export interface SourceCodeResponse extends SourceCodeShort {
  created_at: string;
  updated_at: string;
  status: string;
  state: string;
  revision_number: number;
  labels: string[];
  integration: IntegrationShort | null;
  git_tags: string[];
  git_tag_messages: Record<string, string>;
  git_branches: string[];
  git_branch_messages: Record<string, string>;
  git_folders_map: RefFolders[];
  creator: UserShort | null;
  description: string;
}

export interface SourceCodeCreate {
  description: string;
  source_code_url: string;
  source_code_provider: string;
  source_code_language: string;
  integration_id: string | null;
  labels: string[];
}

export interface SourceCodeUpdate {
  description: string;
  integration_id: string | null;
  labels: string[];
}
