export interface RefFolders {
  ref: string;
  folders: string[];
}

// module_library: reusable modules used through source code versions, templates and executors;
// iac: modules run per environment by InfraKitchen; application: the code of a service.
export type RepositoryType = "module_library" | "iac" | "application";

export const REPOSITORY_TYPE_LABELS: Record<RepositoryType, string> = {
  module_library: "Module Library",
  iac: "Infrastructure as Code",
  application: "Application",
};

export interface SourceCodeCreate {
  description: string;
  sourceCodeUrl: string;
  sourceCodeProvider: string;
  sourceCodeLanguage: string;
  repositoryType: RepositoryType;
  integrationId: string | null;
  labels: string[];
}
