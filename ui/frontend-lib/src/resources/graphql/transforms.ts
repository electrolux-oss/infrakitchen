import { GqlIntegrationShort } from "../../integrations/graphql";
import { GqlSecret } from "../../secrets/graphql";
import { GqlSourceCodeVersionShort } from "../../source_code_versions/graphql";
import { GqlStorage } from "../../storages/graphql";
import { GqlTemplateShort } from "../../templates/graphql";
import { GqlUserShort } from "../../users/graphql";
import { GqlWorkspaceShort } from "../../workspaces/graphql";

import type {
  ResourceGraphqlShortField,
  ResourceGraphqlDetailField,
  ResourceGraphqlRelationField,
} from "./fragments";

type GqlResourceShortFieldTypes = {
  id: string;
  name: string;
  state: string;
  status: string;
  isFavorite: boolean;
  entityName: string;
};

export type GqlResourceShort = Pick<
  GqlResourceShortFieldTypes,
  ResourceGraphqlShortField
> & {
  template: GqlTemplateShort;
};

type GqlResourceDetailFieldTypes = {
  id: string;
  name: string;
  description: string;
  abstract: boolean;
  revisionNumber: number;
  storagePath: string | null;
  variables: Array<Record<string, any>> | null;
  outputs: Array<Record<string, any>> | null;
  dependencyTags: Array<Record<string, any>> | null;
  dependencyConfig: Array<Record<string, any>> | null;
  state: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  labels: string[] | null;
  isFavorite: boolean;
  entityName: string;
};

type GqlResourceRelationFieldTypes = {
  template: GqlTemplateShort | null;
  sourceCodeVersion: GqlSourceCodeVersionShort | null;
  integrationIds: GqlIntegrationShort[] | null;
  secretIds: GqlSecret[] | null;
  storage: GqlStorage | null;
  creator: GqlUserShort | null;
  parents: GqlResourceShort[] | null;
  children: GqlResourceShort[] | null;
  workspace: GqlWorkspaceShort | null;
};

type GqlResourceFieldTypes = GqlResourceDetailFieldTypes &
  GqlResourceRelationFieldTypes;

export type GqlResource = Pick<
  GqlResourceFieldTypes,
  ResourceGraphqlDetailField | ResourceGraphqlRelationField
>;

export type GqlResourceOptional = Partial<GqlResource> &
  Pick<GqlResourceShortFieldTypes, "id" | "name" | "entityName">;

export interface GqlResourceTempState {
  resourceId: string;
  value: Record<string, any>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GqlResourceTreeNode {
  id: string;
  name: string;
  state: string;
  status: string;
  templateName: string;
  nodeId: string;
  children: GqlResourceTreeNode[];
}
