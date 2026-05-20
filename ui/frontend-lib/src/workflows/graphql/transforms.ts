import { IntegrationShort } from "../../integrations/types";
import { SecretShort } from "../../secrets/types";
import { SourceCodeVersionShort } from "../../source_code_versions/types";
import { TemplateShort } from "../../templates/types";
import { UserShort } from "../../users/types";
import {
  ResourceShortWithStatus,
  WorkflowResponse,
  WorkflowStepResponse,
} from "../types";

export interface GqlIntegration {
  id: string;
  name: string;
  integrationProvider: string;
}

export interface GqlSecret {
  id: string;
  name: string;
  secretProvider: string;
}

export interface GqlTemplate {
  id: string;
  name: string;
  abstract: boolean;
  cloudResourceTypes?: string[];
}

export interface GqlResource {
  id: string;
  name: string;
  status: string;
  template: GqlTemplate | null;
}

export interface GqlSourceCodeVersion {
  id: string;
  sourceCodeVersion: string | null;
  sourceCodeBranch: string | null;
}

export interface GqlUser {
  id: string;
  identifier: string;
}

export interface GqlWorkflowStep {
  id: string;
  templateId: string;
  template: GqlTemplate | null;
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
  sourceCodeVersion?: GqlSourceCodeVersion | null;
  parentResourceIds?: ResourceShortWithStatus[] | null;
  integrationIds?: GqlIntegration[] | null;
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
  createdBy?: string | null;
  creator?: GqlUser | null;
}

function toIntegrationShort(g: GqlIntegration): IntegrationShort {
  return {
    id: g.id,
    name: g.name,
    integration_provider: g.integrationProvider,
    _entity_name: "integration",
  };
}

function toSecretShort(g: GqlSecret): SecretShort {
  return {
    id: g.id,
    name: g.name,
    secret_provider: g.secretProvider,
    _entity_name: "secret",
  };
}

function toTemplateShort(g: GqlTemplate): TemplateShort {
  return {
    id: g.id,
    name: g.name,
    abstract: g.abstract,
    cloud_resource_types: g.cloudResourceTypes,
    _entity_name: "template",
  };
}

function toResourceShort(g: GqlResource): ResourceShortWithStatus {
  return {
    id: g.id,
    name: g.name,
    status: g.status,
    template: g.template
      ? toTemplateShort(g.template)
      : {
          id: "",
          name: "",
          _entity_name: "template",
          cloud_resource_types: [],
          abstract: false,
        },
    _entity_name: "resource",
  };
}

function toSourceCodeVersionShort(
  g: GqlSourceCodeVersion,
): SourceCodeVersionShort {
  return {
    id: g.id,
    identifier: g.sourceCodeVersion || g.sourceCodeBranch || g.id.slice(0, 8),
    source_code_version: g.sourceCodeVersion ?? "",
    source_code_branch: g.sourceCodeBranch ?? "",
    source_code_folder: "",
    template: {
      id: "",
      name: "",
      _entity_name: "template",
      cloud_resource_types: [],
      abstract: false,
    },
    source_code: {
      id: "",
      identifier: "",
      source_code_url: "",
      source_code_provider: "",
      source_code_language: "",
      _entity_name: "source_code",
    },
    _entity_name: "source_code_version",
  };
}

function toUserShort(g: GqlUser): UserShort {
  return {
    id: g.id,
    identifier: g.identifier,
    _entity_name: "user",
    provider: "",
  };
}

function toWorkflowStep(g: GqlWorkflowStep): WorkflowStepResponse {
  return {
    id: g.id,
    template_id: g.templateId,
    template: g.template ? toTemplateShort(g.template) : null,
    resource_id: g.resourceId ?? null,
    resource: g.resource ? toResourceShort(g.resource) : null,
    source_code_version_id: g.sourceCodeVersionId ?? null,
    source_code_version: g.sourceCodeVersion
      ? toSourceCodeVersionShort(g.sourceCodeVersion)
      : null,
    parent_resource_ids: (g.parentResourceIds ?? []).map(toResourceShort),
    integration_ids: (g.integrationIds ?? []).map(toIntegrationShort),
    secret_ids: (g.secretIds ?? []).map(toSecretShort),
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
    creator: gql.creator
      ? toUserShort(gql.creator)
      : { id: "", identifier: "", _entity_name: "user", provider: "" },
    started_at: gql.startedAt,
    completed_at: gql.completedAt,
    created_at: gql.createdAt,
    _entity_name: "workflow",
  };
}

export interface GqlWorkflowListItem {
  id: string;
  action: string;
  status: string;
  errorMessage: string | null;
  creator: GqlUser | null;
  steps: { id: string; status: string }[] | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export function transformWorkflowListItem(
  g: GqlWorkflowListItem,
): Record<string, any> {
  return {
    id: g.id,
    action: g.action || "create",
    status: g.status,
    error_message: g.errorMessage,
    creator: g.creator
      ? { id: g.creator.id, identifier: g.creator.identifier }
      : null,
    steps: g.steps ?? [],
    started_at: g.startedAt,
    completed_at: g.completedAt,
    created_at: g.createdAt,
    _entity_name: "workflow",
  };
}
