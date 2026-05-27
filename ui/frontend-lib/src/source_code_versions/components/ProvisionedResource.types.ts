import {
  WIRING_CUSTOM_HEADER_COLORS,
  type WiringColorKey,
} from "../../common/components/viewers/Wiring/WiringColors";

export interface ProvisionedResource {
  type: string;
  name: string;
  provider: string;
  depends_on: string[];
  module_source?: string | null;
  conditional?: boolean;
}

export interface ResourceDisplayParts {
  title: string;
  subtitle: string;
  tertiary?: string;
  colorKey?: WiringColorKey;
}

function isProviderColorKey(
  value: string,
): value is Exclude<WiringColorKey, "default" | "module"> {
  return (
    value !== "module" &&
    Object.prototype.hasOwnProperty.call(WIRING_CUSTOM_HEADER_COLORS, value)
  );
}

function colorKeyFromProvider(provider: string): WiringColorKey {
  const normalized = provider.toLowerCase().trim();
  const firstToken = normalized.split(/[._-]/).find(Boolean) ?? normalized;
  if (isProviderColorKey(normalized)) return normalized;
  if (isProviderColorKey(firstToken)) return firstToken;
  return "default";
}

function formatModuleSource(moduleSource?: string | null): string {
  const source = (moduleSource || "").trim();
  if (!source) return "module";
  if (source.length <= 64) return source;
  return `${source.slice(0, 32)}...${source.slice(-20)}`;
}

export function provisionedResourceId(resource: ProvisionedResource): string {
  return resource.type === "module"
    ? `module.${resource.name}`
    : `${resource.type}.${resource.name}`;
}

export function resourceDisplayParts(
  resource: ProvisionedResource,
): ResourceDisplayParts {
  const provider = resource.provider || "provider";
  const type = resource.type || "resource";
  const name = resource.name || "unnamed";
  if (type === "module") {
    return {
      title: "Module",
      subtitle: formatModuleSource(resource.module_source),
      tertiary: name,
      colorKey: "module",
    };
  }

  return {
    title: `Resource: ${provider}`,
    subtitle: type,
    tertiary: name,
    colorKey: colorKeyFromProvider(provider),
  };
}
