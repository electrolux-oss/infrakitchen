import { IntegrationShort } from "../integrations/types";
import { UserShort } from "../users";

export interface StorageShort {
  id: string;
  name: string;
  _entity_name: string;
}

export interface StorageResponse extends StorageShort {
  created_at: Date;
  updated_at: Date;
  status: string;
  state: string;
  description: string;
  revision_number: number;
  labels: string[];
  integration: IntegrationShort;
  creator: UserShort;
  storage_type: string;
  storage_provider: string;
  configuration: object;
  resources_count: number;
  executors_count: number;
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

export interface StorageUpdate {
  description: string;
  labels: string[];
}
