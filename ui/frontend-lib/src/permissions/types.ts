import { UserResponseOptional, UserShort } from "../users";

export interface PermissionResponse {
  id: string;
  created_at: Date;
  updated_at: Date;
  creator?: UserShort;
  ptype: string;
  v0: string | null;
  v1: string | null;
  v2: string | null;
  v3: string | null;
  v4: string | null;
  v5: string | null;
  // custom fields
  entity_data?: {
    name?: string;
    id?: string;
    _entity_name?: string;
  };
  user_data?: UserResponseOptional;
}

export interface EntityPolicyCreate {
  role?: string;
  user_id?: string;
  entity_id: string;
  entity_name: string;
  action: string;
  inherits_children: boolean;
}

export interface ResourceUserPolicyCreate {
  resource_id: string;
  user_id: string;
  action: string;
}

export interface ApiPolicyCreate {
  role: string;
  action: string;
  // Field for api_policy
  selectedApiPermissions?: { api: string; actions: string[] }[];
}
