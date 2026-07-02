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
