import { TEMPLATE_STATUS } from "./constants";

export type IntegrationProviderType =
  | "aws"
  | "azurerm"
  | "gcp"
  | "mongodb_atlas"
  | "datadog";

export type TemplateStatus =
  (typeof TEMPLATE_STATUS)[keyof typeof TEMPLATE_STATUS];

export interface TemplateConfig {
  one_resource_per_integration: IntegrationProviderType[];
  allowed_provider_integration_types: IntegrationProviderType[];
  naming_convention: string | null;
  required_configuration_variables: string[];
}

export interface TemplateImportRequest {
  sourceCodeLanguage: string;
  integrationId: string;
  sourceCodeUrl: string;
  sourceCodeFolder: string;
  sourceCodeBranch: string;
  name: string;
  description?: string;
  documentation: string;
  labels: string[];
  parents: string[];
}

export interface TemplateCreateRequest {
  name: string;
  description: string;
  documentation: string;
  template: string;
  parents: string[];
  children: string[];
  labels: string[];
  cloudResourceTypes: string[];
  configuration: TemplateConfig;
  abstract: boolean;
}
