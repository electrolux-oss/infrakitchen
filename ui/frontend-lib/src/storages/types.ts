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
}

export interface StorageCreate {
  name: string;
  description: string;
  integration_id: string;
  labels: string[];
  storage_type: string;
  storage_provider: string;
  configuration: object;
}

export interface StorageUpdate {
  description: string;
  labels: string[];
}
