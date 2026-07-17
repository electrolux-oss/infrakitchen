import { GqlUserShort } from "../../users/graphql";

import type {
  ProjectGraphqlShortField,
  ProjectGraphqlDetailField,
  ProjectGraphqlRelationField,
} from "./fragments";

type GqlProjectShortFieldTypes = {
  id: string;
  name: string;
  status: string;
  entityName: string;
  owners: GqlUserShort[] | null;
};

export type GqlProjectShort = Pick<
  GqlProjectShortFieldTypes,
  ProjectGraphqlShortField
>;

type GqlProjectDetailFieldTypes = {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string | null;
  configuration: Record<string, any> | null;
  dependencyTags: Record<string, any>[] | null;
  dependencyConfig: Record<string, any>[] | null;
  labels: string[] | null;
  status: string;
  revisionNumber: number;
  resourcesCount: number;
  createdAt: string;
  updatedAt: string;
  entityName: string;
};

type GqlProjectRelationFieldTypes = {
  creator: GqlUserShort | null;
  owners: GqlUserShort[] | null;
  workspace: { id: string; name: string } | null;
};

type GqlProjectFieldTypes = GqlProjectDetailFieldTypes &
  GqlProjectRelationFieldTypes;

export type GqlProject = Pick<
  GqlProjectFieldTypes,
  ProjectGraphqlDetailField | ProjectGraphqlRelationField
>;
