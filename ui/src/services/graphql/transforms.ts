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
  version: string | null;
  projectId: string;
  sourceCodeId: string | null;
  imageResourceId: string | null;
  dockerfilePath: string;
  buildContext: string;
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
  imageResource: GqlServiceImageResource | null;
};

export type GqlServiceImageResource = {
  id: string;
  name: string;
  state: string;
  status: string;
  outputs: Array<Record<string, any>> | null;
  entityName: string;
};

// Keep in sync with REPOSITORY_URL_OUTPUTS in service_builds/ecr.py
const REPOSITORY_URL_OUTPUTS = ["repository_url", "ecr_repository_url"];

export const getImageRepositoryUrl = (
  resource: GqlServiceImageResource | null,
): string | null => {
  for (const name of REPOSITORY_URL_OUTPUTS) {
    const value = resource?.outputs?.find((item) => item.name === name)?.value;
    if (typeof value === "string" && value) return value;
  }
  return null;
};

export type GqlServiceBuild = {
  id: string;
  serviceId: string;
  commitSha: string;
  version: string | null;
  image: string | null;
  imageDigest: string | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  entityName: string;
  creator: GqlUserShort | null;
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
