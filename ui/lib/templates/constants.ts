import { IntegrationProviderType } from "./types";

export const INTEGRATION_PROVIDER_OPTIONS: IntegrationProviderType[] = [
  "aws",
  "azurerm",
  "gcp",
  "mongodb_atlas",
  "datadog",
];

export const TEMPLATE_STATUS = {
  ENABLED: "enabled",
  DISABLED: "disabled",
} as const;
