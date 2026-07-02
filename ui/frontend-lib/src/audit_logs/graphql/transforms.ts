import { GqlUserShort } from "../../users/graphql";

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
