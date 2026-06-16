import { IntegrationShort } from "../integrations/types";
import { UserShort } from "../users";

export interface StorageShort {
  id: string;
  name: string;
  _entity_name: string;
}

export interface StorageResponse extends StorageShort {
  createdAt: Date;
  updatedAt: Date;
  status: string;
  state: string;
  description: string;
  revisionNumber: number;
  labels: string[];
  integration: IntegrationShort;
  creator: UserShort;
  storageType: string;
  storageProvider: string;
  configuration: object;
  resourcesCount: number;
  executorsCount: number;
}

export type StorageResponseOptional = Partial<StorageResponse>;

export interface StorageCreate {
  name: string;
  description: string;
  integrationId: string;
  labels: string[];
  storageType: string;
  storageProvider: string;
  configuration: object;
}
