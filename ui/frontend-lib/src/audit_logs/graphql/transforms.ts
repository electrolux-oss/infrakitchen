import { GqlUserShort, transformUserShort } from "../../users/graphql";

import type {
  AuditLogGraphqlBaseField,
  AuditLogGraphqlRelationField,
} from "./fragments";

type GqlAuditLogBaseFieldTypes = {
  id: string;
  model: string;
  userId: string | null;
  action: string;
  entityId: string;
  createdAt: string;
  revisionNumber: number | null;
};

type GqlAuditLogRelationFieldTypes = {
  creator: GqlUserShort | null;
};

type GqlAuditLogFieldTypes = GqlAuditLogBaseFieldTypes &
  GqlAuditLogRelationFieldTypes;

export type GqlAuditLog = Pick<
  GqlAuditLogFieldTypes,
  AuditLogGraphqlBaseField | AuditLogGraphqlRelationField
> & {
  entityData?: {
    name?: string;
  };
};

export function transformAuditLog(gql: GqlAuditLog) {
  return {
    id: gql.id,
    model: gql.model,
    user_id: gql.userId,
    action: gql.action,
    entity_id: gql.entityId,
    created_at: new Date(gql.createdAt),
    revision_number: gql.revisionNumber ?? undefined,
    creator: transformUserShort(gql.creator) as any,
    entity_data: {
      name: gql.entityData?.name,
    },
    name: gql.entityData?.name ?? gql.action,
    state: "",
    status: "success" as const,
    updated_at: new Date(gql.createdAt),
    _entity_name: "audit_log",
  };
}

export function transformAuditLogs(gqlLogs: GqlAuditLog[]) {
  return gqlLogs.map(transformAuditLog);
}
