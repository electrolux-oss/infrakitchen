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
  users: UserResponse[] | null;
}
