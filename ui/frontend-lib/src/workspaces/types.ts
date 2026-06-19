export interface WorkspaceCreate {
  name: string;
  description: string;
  integrationId: string;
  labels: string[];
  workspaceProvider: string;
  configuration: Record<string, any>;
}
