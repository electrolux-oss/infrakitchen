import { GqlUserShort } from "../../users/graphql";

import type {
  IntegrationGraphqlBaseField,
  IntegrationGraphqlDetailsField,
  IntegrationGraphqlRelationField,
  IntegrationGraphqlShortField,
} from "./fragments";

type GqlIntegrationShortFieldTypes = {
  id: string;
  name: string;
  integrationProvider: string;
  entityName: string;
};

export type GqlIntegrationShort = Pick<
  GqlIntegrationShortFieldTypes,
  IntegrationGraphqlShortField
>;

type GqlIntegrationBaseFieldTypes = {
  id: string;
  name: string;
  description: string | null;
  integrationType: string;
  integrationProvider: string;
  configuration: Record<string, any> | null;
  labels: string[] | null;
  status: string;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
  entityName: string;
};

type GqlIntegrationRelationFieldTypes = {
  creator: GqlUserShort | null;
};

type GqlIntegrationDetailsFieldTypes = {
  resourceCount: number | null;
  sourceCodeCount: number | null;
  workspaceCount: number | null;
  storageCount: number | null;
  executorCount: number | null;
};

type GqlIntegrationFieldTypes = GqlIntegrationBaseFieldTypes &
  GqlIntegrationRelationFieldTypes &
  GqlIntegrationDetailsFieldTypes;

export type GqlIntegration = Pick<
  GqlIntegrationFieldTypes,
  | IntegrationGraphqlBaseField
  | IntegrationGraphqlRelationField
  | IntegrationGraphqlDetailsField
>;

export type GqlIntegrationOptional = Partial<GqlIntegration> &
  Pick<
    GqlIntegrationShortFieldTypes,
    "id" | "name" | "integrationProvider" | "entityName"
  >;
