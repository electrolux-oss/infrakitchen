export interface ServiceCreateRequest {
  name: string;
  description: string;
  projectId: string;
  repositoryUrl: string | null;
  repositoryIntegrationId: string | null;
  labels: string[];
  owners: string[];
}

export interface ServiceUpdateRequest {
  name?: string;
  description?: string;
  version?: string;
  projectId?: string;
  sourceCodeId?: string;
  imageResourceId?: string;
  dockerfilePath?: string;
  buildContext?: string;
  labels?: string[];
  owners?: string[];
}
