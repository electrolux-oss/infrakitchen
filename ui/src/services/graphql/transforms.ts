import { GqlUserShort } from "../../users/graphql";

import type {
  ServiceGraphqlShortField,
  ServiceGraphqlDetailField,
  ServiceGraphqlRelationField,
} from "./fragments";

type GqlServiceShortFieldTypes = {
  id: string;
  name: string;
  entityName: string;
  owners: GqlUserShort[] | null;
};

export type GqlServiceShort = Pick<
  GqlServiceShortFieldTypes,
  ServiceGraphqlShortField
>;

type GqlServiceDetailFieldTypes = {
  id: string;
  name: string;
  description: string | null;
  projectId: string | null;
  sourceCodeId: string | null;
  labels: string[] | null;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
  entityName: string;
};

type GqlServiceRelationFieldTypes = {
  creator: GqlUserShort | null;
  owners: GqlUserShort[] | null;
  project: { id: string; name: string } | null;
  sourceCode: GqlServiceSourceCode | null;
};

export type GqlServiceSourceCode = {
  id: string;
  identifier: string;
  sourceCodeUrl: string;
  sourceCodeProvider: string;
  defaultBranch: string | null;
  commitCount: number;
  gitTags: string[] | null;
  gitTagShas: Record<string, string> | null;
  status: string;
  updatedAt: string;
  entityName: string;
};

type GqlServiceFieldTypes = GqlServiceDetailFieldTypes &
  GqlServiceRelationFieldTypes;

export type GqlService = Pick<
  GqlServiceFieldTypes,
  ServiceGraphqlDetailField | ServiceGraphqlRelationField
>;
