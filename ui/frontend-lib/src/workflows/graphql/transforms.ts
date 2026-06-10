import {
  GqlIntegrationShort,
  transformIntegrationShort,
} from "../../integrations/graphql";
import { IntegrationShort } from "../../integrations/types";
import { ResourceShort } from "../../resources";
import {
  GqlResource,
  GqlResourceShort,
  transformResource,
  transformResourceShort,
} from "../../resources/graphql";
import { GqlSecret, transformSecret } from "../../secrets/graphql";
import {
  GqlSourceCodeVersionShort,
  transformSourceCodeVersionShort,
} from "../../source_code_versions/graphql";
import {
  GqlTemplateShort,
  transformTemplateShort,
} from "../../templates/graphql";
import { GqlUserShort, transformUserShort } from "../../users/graphql";
import {
  WorkflowResponse,
  WorkflowResponseOptional,
  WorkflowStepResponse,
} from "../types";

export interface GqlWorkflowStep {
  id: string;
  templateId: string;
  template: GqlTemplateShort | null;
  resource: GqlResource | null;
  position: number;
  status: string;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  // Optional - only fetched in the full workflow detail query
  workflowId?: string;
  resourceId?: string | null;
  sourceCodeVersionId?: string | null;
  sourceCodeVersion?: GqlSourceCodeVersionShort | null;
  parentResourceIds?: GqlResourceShort[] | null;
  integrationIds?: GqlIntegrationShort[] | null;
  secretIds?: GqlSecret[] | null;
  storageId?: string | null;
  resolvedVariables?: Record<string, any> | null;
}

export interface GqlWorkflow {
  id: string;
  action: string;
  status: string;
  errorMessage: string | null;
  steps: GqlWorkflowStep[] | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  // Optional - only fetched in the full workflow detail query
  wiringSnapshot?: any;
  creator: GqlUserShort | null;
}

export type GqlWorkflowOptional = Partial<GqlWorkflow> & { id: string };

function toWorkflowStep(g: GqlWorkflowStep): WorkflowStepResponse {
  const parentResourceIds = g.parentResourceIds
    ? g.parentResourceIds
        .map(transformResourceShort)
        .filter((res): res is ResourceShort => res !== null)
    : [];
  const integrationIds = g.integrationIds
    ? g.integrationIds
        .map(transformIntegrationShort)
        .filter((int): int is IntegrationShort => int !== null)
    : [];

  return {
    id: g.id,
    template_id: g.template?.id ?? g.templateId,
    template: g.template ? transformTemplateShort(g.template) : null,
    resource_id: g.resource?.id ?? g.resourceId ?? null,
    resource: g.resource ? transformResource(g.resource) : null,
    source_code_version_id: g.sourceCodeVersionId ?? null,
    source_code_version: g.sourceCodeVersion
      ? transformSourceCodeVersionShort(g.sourceCodeVersion)
      : null,
    parent_resource_ids: parentResourceIds,
    integration_ids: integrationIds,
    secret_ids: (g.secretIds ?? []).map(transformSecret),
    storage_id: g.storageId ? g.storageId : null,
    position: g.position,
    status: g.status as WorkflowStepResponse["status"],
    error_message: g.errorMessage,
    resolved_variables: g.resolvedVariables ?? {},
    started_at: g.startedAt,
    completed_at: g.completedAt,
  };
}

export function transformWorkflow(gql: GqlWorkflow): WorkflowResponse {
  return {
    id: gql.id,
    action: (gql.action || "create") as WorkflowResponse["action"],
    status: gql.status as WorkflowResponse["status"],
    error_message: gql.errorMessage,
    steps: (gql.steps ?? []).map(toWorkflowStep),
    wiring_snapshot: gql.wiringSnapshot ?? [],
    creator: transformUserShort(gql.creator)!,
    started_at: gql.startedAt,
    completed_at: gql.completedAt,
    created_at: gql.createdAt,
    _entity_name: "workflow",
  };
}

export function transformWorkflowOptional(
  gql: GqlWorkflowOptional,
): WorkflowResponseOptional {
  return {
    id: gql.id,
    action: (gql.action || "create") as WorkflowResponse["action"] | undefined,
    status: gql.status as WorkflowResponse["status"] | undefined,
    error_message: gql.errorMessage,
    steps: gql.steps ? gql.steps.map(toWorkflowStep) : undefined,
    wiring_snapshot: gql.wiringSnapshot ?? undefined,
    creator:
      gql.creator !== undefined ? transformUserShort(gql.creator)! : undefined,
    started_at: gql.startedAt,
    completed_at: gql.completedAt,
    created_at: gql.createdAt,
    _entity_name: "workflow",
  };
}
