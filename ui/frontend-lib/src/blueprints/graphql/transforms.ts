import { WiringRule } from "../../common/components/viewers/Wiring/types";
import { TemplateShort } from "../../templates/types";
import { GqlWorkflow, transformWorkflow } from "../../workflows/graphql";
import { BlueprintResponse } from "../types";

interface GqlTemplateShort {
  id: string;
  name: string;
  abstract: boolean;
  cloudResourceTypes?: string[];
}

interface GqlTemplateWithParents extends GqlTemplateShort {
  parents?: GqlTemplateShort[] | null;
}

export interface GqlBlueprint {
  id: string;
  name: string;
  description: string | null;
  templates: GqlTemplateShort[] | null;
  externalTemplates: GqlTemplateShort[] | null;
  wiring: any;
  defaultVariables: any;
  configuration: any;
  labels: string[] | null;
  status: string;
  revisionNumber: number;
  createdBy: string | null;
  creator: { id: string; identifier: string } | null;
  workflows: GqlWorkflow[] | null;
  createdAt: string;
  updatedAt: string;
}

function toTemplateShort(t: GqlTemplateShort) {
  return {
    id: t.id,
    name: t.name,
    abstract: t.abstract,
    cloud_resource_types: t.cloudResourceTypes ?? [],
    _entity_name: "template" as const,
  };
}

export function transformBlueprint(gql: GqlBlueprint): BlueprintResponse {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description ?? "",
    templates: (gql.templates ?? []).map(toTemplateShort),
    external_templates: (gql.externalTemplates ?? []).map(toTemplateShort),
    wiring: gql.wiring ?? [],
    default_variables: gql.defaultVariables ?? {},
    configuration: gql.configuration ?? {},
    labels: gql.labels ?? [],
    status: gql.status as BlueprintResponse["status"],
    revision_number: gql.revisionNumber,
    created_by: gql.creator
      ? {
          id: gql.creator.id,
          identifier: gql.creator.identifier,
          provider: "",
          _entity_name: "user" as const,
        }
      : (gql.createdBy ?? ""),
    workflows: (gql.workflows ?? []).map(transformWorkflow),
    created_at: gql.createdAt,
    updated_at: gql.updatedAt,
    _entity_name: "blueprint",
  };
}

export interface GqlBlueprintListItem {
  id: string;
  name: string;
  description: string | null;
  templates: { id: string; name: string }[] | null;
  labels: string[] | null;
  status: string;
  updatedAt: string;
}

export function transformBlueprintListItem(
  g: GqlBlueprintListItem,
): Record<string, any> {
  return {
    id: g.id,
    name: g.name,
    description: g.description ?? "",
    templates: (g.templates ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      _entity_name: "template",
    })),
    labels: g.labels ?? [],
    status: g.status,
    updated_at: g.updatedAt,
    _entity_name: "blueprint",
  };
}

export interface GqlBlueprintUse {
  id: string;
  name: string;
  templates: GqlTemplateWithParents[] | null;
  externalTemplates: GqlTemplateShort[] | null;
  wiring: any;
  configuration: any;
}

export interface BlueprintUseData {
  id: string;
  name: string;
  templates: (TemplateShort & { parents: TemplateShort[] })[];
  external_templates: TemplateShort[];
  wiring: WiringRule[];
  configuration: Record<string, any>;
}

export function transformBlueprintUse(gql: GqlBlueprintUse): BlueprintUseData {
  return {
    id: gql.id,
    name: gql.name,
    templates: (gql.templates ?? []).map((t) => ({
      ...toTemplateShort(t),
      parents: (t.parents ?? []).map(toTemplateShort),
    })),
    external_templates: (gql.externalTemplates ?? []).map(toTemplateShort),
    wiring: gql.wiring ?? [],
    configuration: gql.configuration ?? {},
  };
}
