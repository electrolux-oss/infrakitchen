import { GqlUserShort } from "../../users/graphql";

import type {
  ServiceGraphqlShortField,
  ServiceGraphqlDetailField,
  ServiceGraphqlRelationField,
} from "./fragments";

type GqlServiceShortFieldTypes = {
  id: string;
  name: string;
  displayName: string | null;
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
  displayName: string | null;
  description: string | null;
  projectId: string;
  repositoryUrl: string | null;
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
};

type GqlServiceFieldTypes = GqlServiceDetailFieldTypes &
  GqlServiceRelationFieldTypes;

export type GqlService = Pick<
  GqlServiceFieldTypes,
  ServiceGraphqlDetailField | ServiceGraphqlRelationField
>;
