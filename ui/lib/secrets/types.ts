export interface CustomSecret {
  name: string;
  value: string;
}

export interface CustomSecretConfig {
  secrets: CustomSecret[];
  secret_provider: string;
}

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

export interface SecretValidationResult {
  isValid: boolean;
  message: string | null;
}
