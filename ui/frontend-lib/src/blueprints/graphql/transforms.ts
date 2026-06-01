import { WiringRule } from "../../common/components/viewers/Wiring/types";
import {
  GqlTemplateShort,
  transformTemplateShort,
} from "../../templates/graphql";
import { TemplateShort } from "../../templates/types";
import { UserShort } from "../../users";
import { GqlUserShort, transformUserShort } from "../../users/graphql";
import { GqlWorkflow, transformWorkflow } from "../../workflows/graphql";
import { BlueprintResponse, BlueprintResponseOptional } from "../types";

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
  creator: GqlUserShort | null;
  workflows: GqlWorkflow[] | null;
  createdAt: string;
  updatedAt: string;
}

export type GqlBlueprintOptional = Partial<GqlBlueprint> & {
  id: string;
  name: string;
};

export function transformBlueprint(gql: GqlBlueprint): BlueprintResponse {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description ?? "",
    templates: (gql.templates ?? []).map(transformTemplateShort),
    external_templates: (gql.externalTemplates ?? []).map(
      transformTemplateShort,
    ),
    wiring: gql.wiring ?? [],
    default_variables: gql.defaultVariables ?? {},
    configuration: gql.configuration ?? {},
    labels: gql.labels ?? [],
    status: gql.status as BlueprintResponse["status"],
    revision_number: gql.revisionNumber,
    creator: transformUserShort(gql.creator) as UserShort,
    workflows: (gql.workflows ?? []).map(transformWorkflow),
    created_at: gql.createdAt,
    updated_at: gql.updatedAt,
    _entity_name: "blueprint",
  };
}

export function transformBlueprintOptional(
  gql: GqlBlueprintOptional,
): BlueprintResponseOptional {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description ?? undefined,
    templates: gql.templates
      ? gql.templates.map(transformTemplateShort)
      : undefined,
    external_templates: gql.externalTemplates
      ? gql.externalTemplates.map(transformTemplateShort)
      : undefined,
    wiring: gql.wiring ?? undefined,
    default_variables: gql.defaultVariables ?? undefined,
    configuration: gql.configuration ?? undefined,
    labels: gql.labels ?? undefined,
    status: gql.status as BlueprintResponse["status"] | undefined,
    revision_number: gql.revisionNumber,
    creator:
      gql.creator !== undefined
        ? (transformUserShort(gql.creator) as UserShort)
        : undefined,
    workflows: gql.workflows ? gql.workflows.map(transformWorkflow) : undefined,
    created_at: gql.createdAt,
    updated_at: gql.updatedAt,
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
      ...transformTemplateShort(t),
      parents: (t.parents ?? []).map(transformTemplateShort),
    })),
    external_templates: (gql.externalTemplates ?? []).map(
      transformTemplateShort,
    ),
    wiring: gql.wiring ?? [],
    configuration: gql.configuration ?? {},
  };
}
