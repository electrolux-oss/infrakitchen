import { UserShort } from "../users";

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
  oneResourcePerIntegration: IntegrationProviderType[];
  allowedProviderIntegrationTypes: IntegrationProviderType[];
  namingConvention: string | null;
  requiredConfigurationVariables: string[];
}

export interface TemplateShort {
  id: string;
  name: string;
  abstract: boolean;
  cloudResourceTypes?: string[];
  _entity_name: string;
}

export interface TemplateResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: TemplateStatus;
  abstract: boolean;
  revisionNumber: number;
  creator: UserShort | null;
  name: string;
  description: string;
  documentation?: string;
  template: string;
  parents: TemplateShort[];
  children: TemplateShort[];
  cloudResourceTypes: string[];
  configuration: TemplateConfig;
  labels: string[];
  resourcesCount?: number;
  sourceCodeVersionsCount?: number;
  _entity_name: string;
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
