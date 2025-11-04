export interface UserShort {
  id: string;
  identifier: string;
  _entity_name: string;
  provider: string;
}

export interface UserResponse extends UserShort {
  created_at: Date;
  updated_at: Date;
  description: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  deactivated: boolean;
  is_primary: boolean;
  secondary_accounts: UserShort[] | null;
  primary_account: UserShort[] | null;
  provider: string;
  password: string;
}

export interface UserCreate {
  identifier: string;
  description: string;
  password: string;
}

export interface UserUpdate {
  description: string;
  deactivated: boolean;
  password: string;
}
