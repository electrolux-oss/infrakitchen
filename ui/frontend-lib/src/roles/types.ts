export interface RoleCreate {
  casbin_type: string;
  role: string;
  user_id: string;
}

export interface User {
  id: string;
  identifier: string;
}
