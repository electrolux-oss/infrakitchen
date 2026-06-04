import { IntegrationShort } from "../integrations/types";
import { UserShort } from "../users";

export interface WorkspaceShort {
  id: string;
  name: string;
  workspace_provider: string;
  _entity_name: string;
}

export interface WorkspaceResponse extends WorkspaceShort {
  created_at: Date;
  updated_at: Date;
  description: string;
  labels: string[];
  integration: IntegrationShort;
  creator: UserShort;
  status: string;
  workspace_provider: string;
  configuration: Record<string, any>;
  resources_count: number;
}

export type WorkspaceResponseOptional = Partial<WorkspaceResponse>;

export interface WorkspaceCreate {
  name: string;
  description: string;
  integration_id: string;
  labels: string[];
  workspace_provider: string;
  configuration: Record<string, any>;
}

export interface WorkspaceUpdate {
  description: string;
  labels: string[];
}
