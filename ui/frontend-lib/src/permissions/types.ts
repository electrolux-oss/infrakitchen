import { UserResponse } from "../users";

export interface PermissionResponse {
  id: string;
  created_at: Date;
  updated_at: Date;
  description: string;
  creator: UserResponse;
  ptype: string;
  v0: string | null;
  v1: string | null;
  v2: string | null;
  v3: string | null;
  v4: string | null;
  v5: string | null;
}

export interface EntityPolicyCreate {
  role?: string;
  user_id?: string;
  entity_id: string;
  entity_name: string;
  action: string;
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
