import { UserResponseOptional, UserShort } from "../users";

export interface PermissionResponse {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  creator?: UserShort;
  ptype: string;
  v0: string | null;
  v1: string | null;
  v2: string | null;
  v3: string | null;
  v4: string | null;
  v5: string | null;
  // custom fields
  entityData?: {
    name?: string;
    id?: string;
    _entity_name?: string;
  };
  userData?: UserResponseOptional;
}

export interface EntityPolicyCreate {
  role?: string;
  userId?: string;
  entityId: string;
  entityName: string;
  action: string;
  inheritsChildren: boolean;
}

export interface ResourceUserPolicyCreate {
  resourceId: string;
  userId: string;
  action: string;
}

export interface ApiPolicyCreate {
  role: string;
  action: string;
  // Field for api_policy
  selectedApiPermissions?: { api: string; actions: string[] }[];
}
