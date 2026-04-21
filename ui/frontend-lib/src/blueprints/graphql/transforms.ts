import { BlueprintResponse } from "../types";
import { GqlWorkflow, transformWorkflow } from "../../workflows/graphql";

export interface GqlBlueprint {
  id: string;
  name: string;
  description: string | null;
  templates: { id: string; name: string; cloudResourceTypes: string[] }[] | null;
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

export function transformBlueprint(gql: GqlBlueprint): BlueprintResponse {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description ?? "",
    templates: (gql.templates ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      cloud_resource_types: t.cloudResourceTypes ?? [],
      _entity_name: "template" as const,
    })),
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
