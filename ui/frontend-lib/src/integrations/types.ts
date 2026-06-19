import React from "react";

import { IconProps } from "../icons/Icons";

export interface IntegrationCreate {
  id: string;
  name: string;
  description: string;
  integrationType: string;
  integrationProvider: string;
  labels: string[];
  configuration: object;
}

export interface IntegrationWithStorageCreate extends IntegrationCreate {
  createStorage: boolean;
}

export enum IntegrationType {
  GIT = "git",
  CLOUD = "cloud",
  NOTIFICATION = "notification",
}

export enum ConnectionType {
  SSH = "ssh",
  TOKEN = "token",
}

export interface Provider {
  type: IntegrationType;
  connectionType?: ConnectionType;
  name: string;
  icon: React.FC<IconProps>;
  slug: string;
  instructions: string[];
  tokenLink: string;
}

export interface IntegrationValidationResult {
  isValid: boolean;
  message: string | null;
}
