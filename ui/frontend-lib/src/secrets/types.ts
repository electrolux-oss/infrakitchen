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
  secretProvider: string;
  _entity_name: string;
}

export interface SecretResponse extends SecretShort {
  createdAt: Date;
  updatedAt: Date;
  status: string;
  state: string;
  description: string;
  revisionNumber: number;
  labels: string[];
  integration: IntegrationShort | null;
  creator: UserShort;
  secretType: string;
  secretProvider: string;
  configuration: CustomSecretConfig;
  resourcesCount: number;
  executorsCount: number;
}

export type SecretResponseOptional = Partial<SecretResponse>;

export interface SecretCreate {
  name: string;
  description: string;
  integrationId: string | null;
  labels: string[];
  secretType: string;
  secretProvider: string;
  configuration: object | CustomSecretConfig;
}

export interface SecretUpdate {
  description: string;
  labels: string[];
  configuration: object | CustomSecretConfig;
}

export interface SecretValidateResponse {
  isValid: boolean;
  message: string | null;
}

export interface SecretValidationResult {
  isValid: boolean;
  message: string | null;
}
