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

export interface IkResourceTempState extends Record<string, any> {
  id: string;
  entity_id: string;
  value: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
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

export interface LogEntity extends Record<string, any> {
  id: string;
  data: string;
  level: string;
  created_at: Date;
  resource: string;
  execution_start: number;
  expired_at?: Date;
}

export interface AuditLogEntity extends IkEntity {
  model: string;
  entity_id: string;
  action: string;
}

export interface ValidationRule {
  min_value?: string | number | null;
  max_value?: string | number | null;
  regex?: string | null;
  max_length?: number | null;
  description?: string | null;
}
