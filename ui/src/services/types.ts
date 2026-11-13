export interface ServiceCreateRequest {
  name: string;
  description: string;
  projectId: string | null;
  repositoryUrl: string | null;
  repositoryIntegrationId: string | null;
  labels: string[];
  owners: string[];
}

export interface ServiceUpdateRequest {
  name?: string;
  description?: string;
  projectId?: string;
  repositoryUrl?: string;
  repositoryIntegrationId?: string | null;
  labels?: string[];
  owners?: string[];
}
