import { GqlIntegrationShort } from "../../integrations/graphql";
import { GqlUserShort } from "../../users/graphql";

import type {
  SourceCodeGraphqlShortField,
  SourceCodeGraphqlDetailField,
  SourceCodeGraphqlRelationField,
} from "./fragments";

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
  integrationId: string | null;
  gitTags: string[] | null;
  gitTagMessages: Record<string, string> | null;
  gitBranches: string[] | null;
  gitBranchMessages: Record<string, string> | null;
  gitFoldersMap: GqlRefFolders[] | null;
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
};

type GqlSourceCodeFieldTypes = GqlSourceCodeDetailFieldTypes &
  GqlSourceCodeRelationFieldTypes;

export type GqlSourceCode = Pick<
  GqlSourceCodeFieldTypes,
  SourceCodeGraphqlDetailField | SourceCodeGraphqlRelationField
>;

export type GqlSourceCodeOptional = Partial<GqlSourceCode> &
  Pick<GqlSourceCodeShortFieldTypes, "id" | "sourceCodeUrl" | "entityName">;
