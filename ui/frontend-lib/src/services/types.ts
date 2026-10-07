export interface ServiceCreateRequest {
  name: string;
  displayName: string | null;
  description: string;
  projectId: string;
  repositoryUrl: string | null;
  labels: string[];
  owners: string[];
}

export interface ServiceUpdateRequest {
  name?: string;
  displayName?: string | null;
  description?: string;
  projectId?: string;
  repositoryUrl?: string | null;
  labels?: string[];
  owners?: string[];
}
