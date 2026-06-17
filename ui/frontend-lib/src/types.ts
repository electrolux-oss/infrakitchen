export * from "./revision/types";
import { UserResponse } from "./users/types";

export interface IkEntity extends Record<string, any> {
  id: string;
  name: string;
  state: string;
  status: string;
  creator?: UserResponse;
  created_at: Date;
  updated_at: Date;

  _entity_name: string;
}

export interface SortPayload {
  field: string;
  order: "ASC" | "DESC";
}

export interface FilterPayload {
  [k: string]: any;
}

export interface PaginationPayload {
  page: number;
  perPage: number;
}

export interface GetListParams {
  pagination?: PaginationPayload;
  sort?: SortPayload;
  filter?: any;
  fields?: string[];
}

export interface GetListResult<RecordType extends IkEntity = any> {
  data: RecordType[];
  total?: number;
  pageInfo?: {
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
}

export interface LogEntity {
  id: string;
  data: string;
  entity_id: string;
  entity: string;
  revision: number;
  audit_log_id?: string;
  trace_id?: string;
  level: string;
  created_at: Date;
  execution_start: number;
  expire_at?: Date;
  _entity_name: "log";
}

export type { GqlAuditLog as AuditLogEntity } from "./audit_logs/graphql";

export type ValidationRuleTargetType = "string" | "number";

export interface ValidationRule {
  id?: string;
  target_type: ValidationRuleTargetType;
  min_value?: string | number | null;
  max_value?: string | number | null;
  regex_pattern?: string | null;
  max_length?: number | null;
  description?: string | null;
}

export interface ValidationRulesByVariable {
  variable_name: string;
  rules: ValidationRule[];
}

export interface ValidationRuleTemplateReferenceCreate {
  template_id: string;
  variable_name: string;
  rule: ValidationRule;
}

export interface ValidationRuleTemplateReferenceReplace {
  rules: ValidationRule[];
}

export interface ValidationRuleTemplateReference {
  id: string;
  template_id: string;
  variable_name: string;
  validation_rule_id: string;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}
