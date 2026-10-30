export interface RefFolders {
  ref: string;
  folders: string[];
}

export type SourceCodeRepositoryType = "module_library" | "iac" | "application";

export const SOURCE_CODE_REPOSITORY_TYPES: {
  value: SourceCodeRepositoryType;
  label: string;
  description: string;
}[] = [
  {
    value: "module_library",
    label: "Module library",
    description: "Modules used by templates",
  },
  {
    value: "iac",
    label: "IaC",
    description: "Deployable infrastructure code",
  },
  {
    value: "application",
    label: "Application",
    description: "The code of a service",
  },
];

export const getRepositoryTypeLabel = (value: string | null | undefined) =>
  SOURCE_CODE_REPOSITORY_TYPES.find((type) => type.value === value)?.label ??
  value ??
  "";

export interface SourceCodeCreate {
  description: string;
  sourceCodeUrl: string;
  sourceCodeProvider: string;
  sourceCodeLanguage: string;
  repositoryType: SourceCodeRepositoryType;
  integrationId: string | null;
  labels: string[];
}
