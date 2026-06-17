import { IntegrationShort } from "../integrations/types";
import { UserShort } from "../users";

export interface WorkspaceShort {
  id: string;
  name: string;
  workspaceProvider: string;
  _entity_name: string;
}

export interface WorkspaceResponse extends WorkspaceShort {
  createdAt: Date;
  updatedAt: Date;
  description: string;
  labels: string[];
  integration: IntegrationShort;
  creator: UserShort;
  status: string;
  workspaceProvider: string;
  configuration: Record<string, any>;
  resourcesCount: number;
}

export type WorkspaceResponseOptional = Partial<WorkspaceResponse>;

export interface WorkspaceCreate {
  name: string;
  description: string;
  integrationId: string;
  labels: string[];
  workspaceProvider: string;
  configuration: Record<string, any>;
}

export interface WorkspaceUpdate {
  description: string;
  labels: string[];
}
