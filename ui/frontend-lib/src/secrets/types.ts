import { IntegrationShort } from "../integrations/types";
import { UserShort } from "../users";

export interface CustomSecret {
  name: string;
  value: string;
}

export interface CustomSecretConfig {
  secrets: CustomSecret[];
  secret_provider: string;
}

export interface SecretShort {
  id: string;
  name: string;
  secret_provider: string;
  _entity_name: string;
}

export interface SecretResponse extends SecretShort {
  created_at: Date;
  updated_at: Date;
  status: string;
  state: string;
  description: string;
  revision_number: number;
  labels: string[];
  integration: IntegrationShort | null;
  creator: UserShort;
  secret_type: string;
  secret_provider: string;
  configuration: CustomSecretConfig;
}

export interface SecretCreate {
  name: string;
  description: string;
  integration_id: string | null;
  labels: string[];
  secret_type: string;
  secret_provider: string;
  configuration: object | CustomSecretConfig;
}

export interface SecretUpdate {
  description: string;
  labels: string[];
  configuration: object | CustomSecretConfig;
}

export interface SecretValidateResponse {
  is_valid: boolean;
  message: string | null;
}
