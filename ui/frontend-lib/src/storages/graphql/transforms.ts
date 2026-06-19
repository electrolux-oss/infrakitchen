import { GqlIntegrationShort } from "../../integrations/graphql";
import { GqlUserShort } from "../../users/graphql";

import type {
  StorageGraphqlShortField,
  StorageGraphqlBaseField,
  StorageGraphqlRelationField,
} from "./fragments";

type GqlStorageShortFieldTypes = {
  id: string;
  name: string;
  storageProvider: string;
  entityName: string;
};

export type GqlStorageShort = Pick<
  GqlStorageShortFieldTypes,
  StorageGraphqlShortField
>;

type GqlStorageBaseFieldTypes = {
  id: string;
  name: string;
  storageType: string;
  storageProvider: string;
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

type GqlStorageRelationFieldTypes = {
  integration: GqlIntegrationShort | null;
  creator: GqlUserShort | null;
};

type GqlStorageFieldTypes = GqlStorageBaseFieldTypes &
  GqlStorageRelationFieldTypes;

export type GqlStorage = Pick<
  GqlStorageFieldTypes,
  StorageGraphqlBaseField | StorageGraphqlRelationField
>;

export type GqlStorageOptional = Partial<GqlStorage> &
  Pick<GqlStorageShortFieldTypes, "id" | "name" | "entityName">;
