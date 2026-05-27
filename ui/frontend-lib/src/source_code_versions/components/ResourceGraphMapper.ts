import {
  GenericTemplate,
  WiringRule,
} from "../../common/components/viewers/Wiring/types";
import { type WiringColorKey } from "../../common/components/viewers/Wiring/WiringColors";

import {
  provisionedResourceId,
  resourceDisplayParts,
  type ProvisionedResource,
} from "./ProvisionedResource.types";

interface ExternalTemplateNode {
  id: string;
  name: string;
  secondaryLabel?: string;
  tertiaryLabel?: string;
  colorKey?: WiringColorKey;
}

interface ResourceGraphModel {
  templates: GenericTemplate[];
  wiring: WiringRule[];
  externalTemplates: ExternalTemplateNode[];
}

function buildExternalTemplate(sourceId: string): ExternalTemplateNode {
  const isExternalModule = sourceId.startsWith("module.");
  const externalName = isExternalModule
    ? sourceId.replace(/^module\./, "") || sourceId
    : sourceId;

  return {
    id: sourceId,
    name: isExternalModule ? "module: external" : "resource: external",
    secondaryLabel: isExternalModule ? "module" : "external",
    tertiaryLabel: externalName,
    colorKey: isExternalModule ? "module" : "default",
  };
}

export function mapResourcesToGraphModel(
  resources: ProvisionedResource[],
): ResourceGraphModel {
  const templates: GenericTemplate[] = resources.map((resource) => {
    const display = resourceDisplayParts(resource);
    return {
      id: provisionedResourceId(resource),
      name: display.title,
      secondaryLabel: display.subtitle,
      tertiaryLabel: display.tertiary,
      colorKey: display.colorKey,
      abstract: false,
      _entity_name: "template",
    };
  });

  const templateIds = new Set(templates.map((template) => template.id));
  const externalMap = new Map<string, ExternalTemplateNode>();
  const wiring: WiringRule[] = [];

  for (const resource of resources) {
    const targetId = provisionedResourceId(resource);
    for (const rawDependency of resource.depends_on || []) {
      const sourceId = String(rawDependency || "").trim();
      if (!sourceId || sourceId === targetId) {
        continue;
      }

      if (!templateIds.has(sourceId) && !externalMap.has(sourceId)) {
        externalMap.set(sourceId, buildExternalTemplate(sourceId));
      }

      wiring.push({
        source_template_id: sourceId,
        source_output: "out",
        target_template_id: targetId,
        target_variable: "in",
      });
    }
  }

  return {
    templates,
    wiring,
    externalTemplates: Array.from(externalMap.values()),
  };
}
