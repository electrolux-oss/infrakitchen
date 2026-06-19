import { GqlIntegrationShort } from "../../integrations/graphql";
import { GqlUserShort } from "../../users/graphql";

import type {
  WorkspaceGraphqlShortField,
  WorkspaceGraphqlDetailField,
  WorkspaceGraphqlRelationField,
} from "./fragments";

type GqlWorkspaceShortFieldTypes = {
  id: string;
  name: string;
  workspaceProvider: string;
  entityName: string;
};

type GqlWorkspaceDetailFieldTypes = {
  id: string;
  name: string;
  workspaceProvider: string;
  configuration: Record<string, any> | null;
  status: string;
  description: string;
  labels: string[] | null;
  resourcesCount: number;
  createdAt: string;
  updatedAt: string;
  entityName: string;
};

type GqlWorkspaceRelationFieldTypes = {
  integration: GqlIntegrationShort | null;
  creator: GqlUserShort | null;
};

export type GqlWorkspaceShort = Pick<
  GqlWorkspaceShortFieldTypes,
  WorkspaceGraphqlShortField
>;

type GqlWorkspaceFieldTypes = GqlWorkspaceDetailFieldTypes &
  GqlWorkspaceRelationFieldTypes;

export type GqlWorkspace = Pick<
  GqlWorkspaceFieldTypes,
  WorkspaceGraphqlDetailField | WorkspaceGraphqlRelationField
>;

export type GqlWorkspaceOptional = Partial<GqlWorkspace> &
  Pick<GqlWorkspaceShortFieldTypes, "id" | "name" | "entityName">;
