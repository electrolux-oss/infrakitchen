export interface RefFolders {
  ref: string;
  folders: string[];
}

export interface SourceCodeCreate {
  description: string;
  sourceCodeUrl: string;
  sourceCodeProvider: string;
  sourceCodeLanguage: string;
  integrationId: string | null;
  labels: string[];
}
