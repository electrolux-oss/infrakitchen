import { GqlUserShort } from "../../users/graphql";

import type {
  TemplateGraphqlShortField,
  TemplateGraphqlDetailField,
  TemplateGraphqlRelationField,
} from "./fragments";

type GqlTemplateShortFieldTypes = {
  id: string;
  name: string;
  abstract: boolean;
  cloudResourceTypes: string[] | null;
  entityName: string;
};

export type GqlTemplateShort = Pick<
  GqlTemplateShortFieldTypes,
  TemplateGraphqlShortField
>;

type GqlTemplateDetailFieldTypes = {
  id: string;
  name: string;
  description: string | null;
  documentation: string | null;
  template: string;
  cloudResourceTypes: string[] | null;
  abstract: boolean;
  configuration: Record<string, any> | null;
  labels: string[] | null;
  status: string;
  revisionNumber: number;
  resourcesCount: number;
  sourceCodeVersionsCount: number;
  createdAt: string;
  updatedAt: string;
  entityName: string;
};

type GqlTemplateRelationFieldTypes = {
  creator: GqlUserShort | null;
  parents: GqlTemplateShort[] | null;
  children: GqlTemplateShort[] | null;
};

type GqlTemplateFieldTypes = GqlTemplateDetailFieldTypes &
  GqlTemplateRelationFieldTypes;

export type GqlTemplate = Pick<
  GqlTemplateFieldTypes,
  TemplateGraphqlDetailField | TemplateGraphqlRelationField
>;

export interface GqlTemplateTreeNode {
  id: string;
  nodeId: string;
  name: string;
  status: string;
  children: GqlTemplateTreeNode[];
}
