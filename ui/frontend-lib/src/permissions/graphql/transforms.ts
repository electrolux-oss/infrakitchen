import {
  GqlUserOptional,
  GqlUserShort,
  transformUserOptional,
  transformUserShort,
} from "../../users/graphql";
import { PermissionResponse } from "../types";

export interface GqlPermission {
  id: string;
  ptype: string;
  v0: string | null;
  v1: string | null;
  v2: string | null;
  v3: string | null;
  v4: string | null;
  v5: string | null;
  createdAt: string;
  updatedAt: string;
  creator: GqlUserShort | null;
  // custom fields
  entityData?: {
    name?: string;
    id?: string;
    _entity_name?: string;
  };
  userData?: GqlUserOptional | null;
}

export function transformPermission(gql: GqlPermission): PermissionResponse {
  return {
    id: gql.id,
    ptype: gql.ptype,
    v0: gql.v0,
    v1: gql.v1,
    v2: gql.v2,
    v3: gql.v3,
    v4: gql.v4,
    v5: gql.v5,
    created_at: new Date(gql.createdAt),
    updated_at: new Date(gql.updatedAt),
    creator: gql.creator ? transformUserShort(gql.creator)! : undefined,
    entity_data: gql.entityData,
    user_data: gql.userData ? transformUserOptional(gql.userData) : undefined,
  };
}

export function transformPermissions(gqlList: GqlPermission[]) {
  return gqlList.map(transformPermission);
}
