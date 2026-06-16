import React from "react";

import { IconProps } from "../icons/Icons";
import { UserShort } from "../users";
import { INTEGRATION_STATUS } from "../utils/constants";

export interface IntegrationShort {
  id: string;
  name: string;
  _entity_name: string;
  integrationProvider: string;
}

export interface IntegrationResponse extends IntegrationShort {
  createdAt: Date;
  updatedAt: Date;
  status: INTEGRATION_STATUS;
  state: string;
  revisionNumber: number;
  labels: string[];
  integrationType: string;
  integrationProvider: string;
  description: string;
  configuration: object;
  creator: UserShort;
  resourceCount?: number;
  sourceCodeCount?: number;
  workspaceCount?: number;
  executorCount?: number;
}

export type IntegrationResponseOptional = Partial<IntegrationResponse>;

export interface IntegrationCreate extends IntegrationShort {
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

export interface IntegrationUpdate extends IntegrationShort {
  name: string;
  description: string;
  labels: string[];
  configuration: object;
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
