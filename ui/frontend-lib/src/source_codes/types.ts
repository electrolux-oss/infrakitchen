import { IntegrationShort } from "../integrations/types";
import { UserShort } from "../users";

export interface RefFolders {
  ref: string;
  folders: string[];
}

export interface SourceCodeShort {
  id: string;
  identifier: string;
  sourceCodeUrl: string;
  sourceCodeProvider: string;
  sourceCodeLanguage: string;
  _entity_name: string;
}

export interface SourceCodeResponse extends SourceCodeShort {
  createdAt: string;
  updatedAt: string;
  status: string;
  revisionNumber: number;
  labels: string[];
  integration: IntegrationShort | null;
  gitTags: string[];
  gitTagMessages: Record<string, string>;
  gitBranches: string[];
  gitBranchMessages: Record<string, string>;
  gitFoldersMap: RefFolders[];
  creator: UserShort | null;
  description: string;
}

export type SourceCodeResponseOptional = Partial<SourceCodeResponse>;

export interface SourceCodeCreate {
  description: string;
  sourceCodeUrl: string;
  sourceCodeProvider: string;
  sourceCodeLanguage: string;
  integrationId: string | null;
  labels: string[];
}

export interface SourceCodeUpdate {
  description: string;
  integrationId: string | null;
  labels: string[];
}
