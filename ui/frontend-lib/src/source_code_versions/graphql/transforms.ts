import {
  GqlSourceCodeShort,
  transformSourceCodeShort,
} from "../../source_codes/graphql";
import {
  GqlTemplateShort,
  transformTemplateShort,
} from "../../templates/graphql";
import { GqlUserShort, transformUserShort } from "../../users/graphql";
import {
  SourceCodeVersionResponse,
  SourceCodeVersionResponseOptional,
  SourceCodeVersionShort,
  SourceConfigResponse,
  SourceConfigTemplateReferenceResponse,
  SourceOutputConfigResponse,
  SourceOutputConfigTemplateResponse,
} from "../types";

export interface GqlSourceCodeVersionShort {
  id: string;
  identifier: string;
  template: GqlTemplateShort;
  sourceCode: GqlSourceCodeShort;
  sourceCodeVersion: string | null;
  sourceCodeBranch: string | null;
  sourceCodeFolder: string;
}

export function transformSourceCodeVersionShort(
  gql: GqlSourceCodeVersionShort,
): SourceCodeVersionShort {
  return {
    id: gql.id,
    identifier: gql.identifier,
    source_code_version: gql.sourceCodeVersion ?? "",
    source_code_branch: gql.sourceCodeBranch ?? "",
    source_code_folder: gql.sourceCodeFolder,
    template: transformTemplateShort(gql.template),
    source_code: transformSourceCodeShort(gql.sourceCode),
    _entity_name: "source_code_version",
  };
}

export interface GqlSourceCodeVersion {
  id: string;
  identifier: string;
  templateId: string | null;
  template: GqlTemplateShort;
  sourceCodeId: string | null;
  sourceCode: GqlSourceCodeShort;
  sourceCodeVersion: string | null;
  sourceCodeBranch: string | null;
  sourceCodeFolder: string;
  variables: any[] | null;
  outputs: any[] | null;
  codeSnapshot: string | null;
  description: string;
  labels: string[] | null;
  resourcesCount: number | null;
  status: string;
  revisionNumber: number;
  creator: GqlUserShort | null;
  createdAt: string;
  updatedAt: string;
}

export type GqlSourceCodeVersionOptional = Partial<GqlSourceCodeVersion> &
  Pick<GqlSourceCodeVersionShort, "id" | "identifier">;

export function transformSourceCodeVersion(
  gql: GqlSourceCodeVersion,
): SourceCodeVersionResponse {
  return {
    id: gql.id,
    identifier: gql.identifier,
    source_code_version: gql.sourceCodeVersion ?? "",
    source_code_branch: gql.sourceCodeBranch ?? "",
    source_code_folder: gql.sourceCodeFolder,
    template: transformTemplateShort(gql.template),
    source_code: transformSourceCodeShort(gql.sourceCode),
    _entity_name: "source_code_version",
    created_at: new Date(gql.createdAt),
    updated_at: new Date(gql.updatedAt),
    status: gql.status?.toLocaleLowerCase(),
    revision_number: gql.revisionNumber,
    labels: gql.labels ?? [],
    creator: transformUserShort(gql.creator)!,
    variables: gql.variables ?? [],
    outputs: gql.outputs ?? [],
    description: gql.description || "",
    resources_count: gql.resourcesCount ?? 0,
    code_snapshot: gql.codeSnapshot || "",
  };
}

export function transformSourceCodeVersionOptional(
  gql: GqlSourceCodeVersionOptional,
): SourceCodeVersionResponseOptional {
  return {
    id: gql.id,
    identifier: gql.identifier,
    source_code_version: gql.sourceCodeVersion ?? undefined,
    source_code_branch: gql.sourceCodeBranch ?? undefined,
    source_code_folder: gql.sourceCodeFolder,
    template: gql.template ? transformTemplateShort(gql.template) : undefined,
    source_code: gql.sourceCode
      ? transformSourceCodeShort(gql.sourceCode)
      : undefined,
    _entity_name: "source_code_version",
    created_at: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updated_at: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
    status: gql.status?.toLocaleLowerCase(),
    revision_number: gql.revisionNumber,
    labels: gql.labels ?? undefined,
    creator:
      gql.creator !== undefined ? transformUserShort(gql.creator)! : undefined,
    variables: gql.variables ?? undefined,
    outputs: gql.outputs ?? undefined,
    description: gql.description ?? undefined,
    resources_count: gql.resourcesCount ?? undefined,
    code_snapshot: gql.codeSnapshot ?? undefined,
  };
}

export interface GqlSourceConfig {
  id: string;
  createdAt: string;
  updatedAt: string;
  index: number;
  sourceCodeVersionId: string;
  required: boolean;
  default: any;
  frozen: boolean;
  unique: boolean;
  restricted: boolean;
  sensitive: boolean;
  name: string;
  description: string;
  type: string;
  options: string[];
}

export interface GqlSourceOutputConfig {
  id: string;
  createdAt: string;
  updatedAt: string;
  index: number;
  sourceCodeVersionId: string;
  name: string;
  description: string;
}

export function transformSourceConfig(
  gql: GqlSourceConfig,
): SourceConfigResponse {
  return {
    id: gql.id,
    created_at: new Date(gql.createdAt),
    updated_at: new Date(gql.updatedAt),
    index: gql.index,
    source_code_version_id: gql.sourceCodeVersionId,
    required: gql.required,
    default: gql.default,
    frozen: gql.frozen,
    unique: gql.unique,
    restricted: gql.restricted,
    sensitive: gql.sensitive,
    name: gql.name,
    description: gql.description,
    type: gql.type,
    options: gql.options ?? [],
  };
}

export function transformSourceOutputConfig(
  gql: GqlSourceOutputConfig,
): SourceOutputConfigResponse {
  return {
    id: gql.id,
    index: gql.index,
    name: gql.name,
    description: gql.description,
    source_code_version_id: gql.sourceCodeVersionId,
  };
}

export interface GqlSourceConfigTemplateReference {
  id: string;
  templateId: string;
  referenceTemplateId: string;
  inputConfigName: string;
  outputConfigName: string;
}

export function transformSourceConfigTemplateReference(
  gql: GqlSourceConfigTemplateReference,
): SourceConfigTemplateReferenceResponse {
  return {
    id: gql.id,
    template_id: gql.templateId,
    reference_template_id: gql.referenceTemplateId,
    input_config_name: gql.inputConfigName,
    output_config_name: gql.outputConfigName,
  };
}

export interface GqlSourceOutputConfigTemplate {
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: string;
}

export function transformSourceOutputConfigTemplate(
  gql: GqlSourceOutputConfigTemplate,
): SourceOutputConfigTemplateResponse {
  return {
    name: gql.name,
    description: gql.description,
    created_at: new Date(gql.createdAt),
    updated_at: new Date(gql.updatedAt),
    status: gql.status,
  };
}
