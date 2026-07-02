import { GqlIntegrationShort } from "../../integrations/graphql";
import { GqlUserShort } from "../../users/graphql";

import type {
  SecretGraphqlShortField,
  SecretGraphqlBaseField,
  SecretGraphqlRelationField,
} from "./fragments";

type GqlSecretShortFieldTypes = {
  id: string;
  name: string;
  secretType: string;
  secretProvider: string;
  entityName: string;
};

export type GqlSecretShort = Pick<
  GqlSecretShortFieldTypes,
  SecretGraphqlShortField
>;

type GqlSecretBaseFieldTypes = {
  id: string;
  name: string;
  secretType: string;
  secretProvider: string;
  configuration: Record<string, any> | null;
  description: string;
  labels: string[] | null;
  state: string;
  status: string;
  revisionNumber: number;
  resourcesCount: number;
  executorsCount: number;
  createdAt: string;
  updatedAt: string;
  entityName: string;
};

type GqlSecretRelationFieldTypes = {
  integration: GqlIntegrationShort | null;
  creator: GqlUserShort | null;
};

type GqlSecretFieldTypes = GqlSecretBaseFieldTypes &
  GqlSecretRelationFieldTypes;

export type GqlSecret = Pick<
  GqlSecretFieldTypes,
  SecretGraphqlBaseField | SecretGraphqlRelationField
>;

export type GqlSecretOptional = Partial<GqlSecret> &
  Pick<GqlSecretShortFieldTypes, "id" | "name" | "entityName">;
