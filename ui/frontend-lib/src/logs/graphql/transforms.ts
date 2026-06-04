import { LogEntity } from "../../types";

import type { LogGraphqlShortField, LogGraphqlBaseField } from "./fragments";

type GqlLogShortFieldTypes = {
  id: string;
  entityId: string;
  entity: string;
  level: string;
  createdAt: string;
};

export type GqlLogShort = Pick<GqlLogShortFieldTypes, LogGraphqlShortField>;

type GqlLogBaseFieldTypes = {
  id: string;
  entityId: string;
  entity: string;
  revision: number;
  auditLogId: string | null;
  level: string;
  data: string;
  createdAt: string;
  executionStart: number;
  expireAt: string | null;
  traceId: string | null;
};

export type GqlLog = Pick<GqlLogBaseFieldTypes, LogGraphqlBaseField>;

export function transformLog(gql: GqlLog): LogEntity {
  return {
    id: gql.id,
    entity_id: gql.entityId,
    entity: gql.entity,
    revision: gql.revision,
    audit_log_id: gql.auditLogId ?? undefined,
    level: gql.level,
    data: gql.data,
    created_at: new Date(gql.createdAt),
    execution_start: gql.executionStart,
    expire_at: gql.expireAt ? new Date(gql.expireAt) : undefined,
    trace_id: gql.traceId ?? undefined,
    _entity_name: "log",
  };
}
