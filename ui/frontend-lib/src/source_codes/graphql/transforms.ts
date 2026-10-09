import { GqlIntegrationShort } from "../../integrations/graphql";
import { GqlUserShort } from "../../users/graphql";
import type { RepositoryType } from "../types";

import type {
  SourceCodeGraphqlShortField,
  SourceCodeGraphqlDetailField,
  SourceCodeGraphqlRelationField,
} from "./fragments";

export type GqlIacRegion = {
  name: string;
  workingDir: string;
  varFiles: string[];
};

export type GqlIacEnvironment = {
  name: string;
  // Folder tofu runs in, relative to the repository root ("" is the root)
  workingDir: string;
  varFiles: string[];
  // Discovered regions; empty when run without regions (or set in its settings)
  regions: GqlIacRegion[];
};

export type GqlIacVariable = {
  name: string;
  type: string;
  description: string;
  // No default, so every run needs a value for it
  required: boolean;
  sensitive: boolean;
};

export type GqlIacModule = {
  name: string;
  path: string;
  // Empty for a module run as is, without environments
  environments: GqlIacEnvironment[];
  variables: GqlIacVariable[];
};

interface GqlRefFolders {
  ref: string;
  folders: string[];
}

type GqlSourceCodeShortFieldTypes = {
  id: string;
  identifier: string;
  sourceCodeUrl: string;
  sourceCodeProvider: string;
  sourceCodeLanguage: string;
  status: string;
  entityName: string;
};

export type GqlSourceCodeShort = Pick<
  GqlSourceCodeShortFieldTypes,
  SourceCodeGraphqlShortField
>;

type GqlSourceCodeDetailFieldTypes = {
  id: string;
  identifier: string;
  description: string | null;
  sourceCodeUrl: string;
  sourceCodeProvider: string;
  sourceCodeLanguage: string;
  repositoryType: RepositoryType;
  integrationId: string | null;
  gitTags: string[] | null;
  gitTagMessages: Record<string, string> | null;
  gitBranches: string[] | null;
  gitBranchMessages: Record<string, string> | null;
  gitFoldersMap: GqlRefFolders[] | null;
  defaultBranch: string | null;
  gitTagShas: Record<string, string> | null;
  commitCount: number;
  // Environments of the discovered modules, in promotion order
  iacEnvironmentNames: string[];
  labels: string[] | null;
  status: string;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
  entityName: string;
};

type GqlSourceCodeRelationFieldTypes = {
  integration: GqlIntegrationShort | null;
  creator: GqlUserShort | null;
  // Runnable modules discovered on the default branch, null until synced
  iacModules: GqlIacModule[] | null;
};

type GqlSourceCodeFieldTypes = GqlSourceCodeDetailFieldTypes &
  GqlSourceCodeRelationFieldTypes;

export type GqlSourceCode = Pick<
  GqlSourceCodeFieldTypes,
  SourceCodeGraphqlDetailField | SourceCodeGraphqlRelationField
>;

export type GqlSourceCodeOptional = Partial<GqlSourceCode> &
  Pick<GqlSourceCodeShortFieldTypes, "id" | "sourceCodeUrl" | "entityName">;

export type GqlSourceCodeTag = {
  name: string;
  sha: string;
};

export type GqlSourceCodeCommit = {
  sha: string;
  shortSha: string;
  message: string;
  description: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  url: string | null;
  author: GqlUserShort | null;
};
