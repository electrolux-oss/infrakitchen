export type WiringColorKey =
  | "module"
  | "aws"
  | "postgresql"
  | "mongodbatlas"
  | "azurerm"
  | "google"
  | "default";

export const WIRING_CUSTOM_HEADER_COLORS: Record<
  Exclude<WiringColorKey, "default">,
  string
> = {
  module: "#7e57c2",
  aws: "#e67a0e",
  postgresql: "#8d6e63",
  mongodbatlas: "#2e7d32",
  azurerm: "#007fff",
  google: "#4285f4",
};