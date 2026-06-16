import {
  GqlIntegrationShort,
  transformIntegrationShort,
} from "../../integrations/graphql";
import { GqlUserShort, transformUserShort } from "../../users/graphql";
import {
  StorageResponse,
  StorageResponseOptional,
  StorageShort,
} from "../types";

import type {
  StorageGraphqlShortField,
  StorageGraphqlBaseField,
  StorageGraphqlRelationField,
} from "./fragments";

type GqlStorageShortFieldTypes = {
  id: string;
  name: string;
  storageProvider: string;
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
  Pick<GqlStorageShortFieldTypes, "id" | "name">;

export function transformStorageShort(gql: GqlStorageShort): StorageShort {
  return {
    id: gql.id,
    name: gql.name,
    _entity_name: "storage",
  };
}

export function transformStorage(gql: GqlStorage): StorageResponse {
  return {
    id: gql.id,
    name: gql.name,
    _entity_name: "storage",
    createdAt: new Date(gql.createdAt),
    updatedAt: new Date(gql.updatedAt),
    status: gql.status,
    state: gql.state,
    description: gql.description ?? "",
    revisionNumber: gql.revisionNumber,
    labels: gql.labels ?? [],
    integration: transformIntegrationShort(gql.integration)!,
    creator: transformUserShort(gql.creator)!,
    storageType: gql.storageType,
    storageProvider: gql.storageProvider,
    configuration: gql.configuration ?? {},
    resourcesCount: gql.resourcesCount ?? 0,
    executorsCount: gql.executorsCount ?? 0,
  };
}

export function transformStorageOptional(
  gql: GqlStorageOptional,
): StorageResponseOptional {
  return {
    id: gql.id,
    name: gql.name,
    _entity_name: "storage",
    createdAt: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updatedAt: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
    status: gql.status,
    state: gql.state,
    description: gql.description ?? undefined,
    revisionNumber: gql.revisionNumber,
    labels: gql.labels ?? undefined,
    integration:
      gql.integration !== undefined
        ? transformIntegrationShort(gql.integration)!
        : undefined,
    creator:
      gql.creator !== undefined ? transformUserShort(gql.creator)! : undefined,
    storageType: gql.storageType,
    storageProvider: gql.storageProvider,
    configuration: gql.configuration ?? undefined,
    resourcesCount: gql.resourcesCount,
    executorsCount: gql.executorsCount,
  };
}
