import { UserShort } from "../users";

export interface TemplateShort {
  id: string;
  name: string;
  cloud_resource_types: string[];
  _entity_name: string;
}

export interface TemplateResponse {
  id: string;
  created_at: string;
  updated_at: string;
  status: "enabled" | "disabled";
  abstract: boolean;
  revision_number: number;
  creator: UserShort | null;
  name: string;
  description: string;
  template: string;
  parents: TemplateShort[];
  children: TemplateShort[];
  cloud_resource_types: string[];
  labels: string[];
  _entity_name: string;
}

export interface TemplateImportRequest {
  source_code_language: string;
  integration_id: string;
  source_code_url: string;
  source_code_folder: string;
  source_code_branch: string;
  name: string;
  description?: string;
  labels: string[];
  parents: string[];
}

export interface TemplateCreateRequest {
  name: string;
  description: string;
  template: string;
  parents: string[];
  children: string[];
  labels: string[];
  cloud_resource_types: string[];
  abstract: boolean;
}

export interface TemplateUpdate extends TemplateShort {
  description: string;
  parents: string[];
  children: string[];
  labels: string[];
  cloud_resource_types: string[];
  abstract: boolean;
}
