import React from "react";

import { ChipProps } from "@mui/material/Chip";

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

/**
 * Maps an integration type to the chip color used on integration cards and
 * overviews, so every type chip renders the same hue everywhere. Cloud is
 * info (blue), notification is warning (orange), and everything else (git)
 * falls back to secondary.
 */
export const integrationTypeChipColor = (
  integrationType: string,
): Exclude<ChipProps["color"], undefined> =>
  integrationType === IntegrationType.CLOUD
    ? "info"
    : integrationType === IntegrationType.NOTIFICATION
      ? "warning"
      : "secondary";

export interface Provider {
  type: IntegrationType;
  connectionType?: ConnectionType;
  name: string;
  icon: React.FC<IconProps>;
  slug: string;
  /**
   * Step-by-step setup instructions. Rendered as React nodes so inline code
   * segments can use the shared InlineCode component instead of raw HTML
   * strings; plain-text steps are plain strings.
   */
  instructions: React.ReactNode[];
  tokenLink: string;
}

export interface IntegrationValidationResult {
  isValid: boolean;
  message: string | null;
}
