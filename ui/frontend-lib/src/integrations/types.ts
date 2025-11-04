import React from "react";

import { IconProps } from "../icons/Icons";
import { UserShort } from "../users";
import { INTEGRATION_STATUS } from "../utils/constants";

export interface IntegrationShort {
  id: string;
  name: string;
  _entity_name: string;
  integration_provider: string;
}

export interface IntegrationResponse extends IntegrationShort {
  created_at: Date;
  updated_at: Date;
  status: INTEGRATION_STATUS;
  state: string;
  revision_number: number;
  labels: string[];
  integration_type: string;
  integration_provider: string;
  description: string;
  configuration: object;
  creator: UserShort;
  url: string;
  repos: number;
  last_sync_at: Date;
}

export interface IntegrationCreate extends IntegrationShort {
  name: string;
  description: string;
  integration_type: string;
  integration_provider: string;
  labels: string[];
  configuration: object;
}

export interface IntegrationWithStorageCreate extends IntegrationCreate {
  create_storage: boolean;
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

export interface IntegrationValidateRequest {
  integration_type: string;
  integration_provider: string;
  configuration: object;
}

export interface IntegrationValidateResponse {
  is_valid: boolean;
  message: string | null;
}
