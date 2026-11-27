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
  dockerfilePath: string;
  buildContext: string;
  buildPlatforms: string[];
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
  registries: GqlServiceRegistry[] | null;
  baseImageRegistries: GqlServiceRegistryIntegration[] | null;
};

export type GqlServiceRegistryIntegration = {
  id: string;
  name: string;
  integrationProvider: string;
  entityName: string;
};

export type GqlServiceRegistry = {
  id: string;
  imageRepository: string;
  registryIntegration: GqlServiceRegistryIntegration | null;
};

export type GqlServiceBuildImage = {
  registryIntegrationId: string;
  registryName: string;
  registryProvider: string;
  imageRepository: string;
  image: string | null;
};

export type GqlServiceBuild = {
  id: string;
  serviceId: string;
  commitSha: string;
  images: GqlServiceBuildImage[];
  tag: string;
  platforms: string[];
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
  integration: { id: string } | null;
};

type GqlServiceFieldTypes = GqlServiceDetailFieldTypes &
  GqlServiceRelationFieldTypes;

export type GqlService = Pick<
  GqlServiceFieldTypes,
  ServiceGraphqlDetailField | ServiceGraphqlRelationField
>;
