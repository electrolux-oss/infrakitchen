export interface StorageCreate {
  name: string;
  description: string;
  integrationId: string;
  labels: string[];
  storageType: string;
  storageProvider: string;
  configuration: object;
}
