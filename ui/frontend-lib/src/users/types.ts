export interface UserShort {
  id: string;
  identifier: string;
  _entity_name: string;
  provider: string;
}

export interface UserMetadata {
  slackId?: string | null;
}

export interface UserResponse extends UserShort {
  createdAt: Date;
  updatedAt: Date;
  description: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  deactivated: boolean;
  isPrimary: boolean;
  secondaryAccounts?: UserShort[] | null;
  primaryAccount?: UserShort[] | null;
  provider: string;
  password?: string;
  meta?: UserMetadata | null;
}

export type UserResponseOptional = Partial<UserResponse>;

export interface UserCreate {
  identifier: string;
  description: string;
  password: string;
}

export interface UserUpdate {
  description?: string;
  deactivated?: boolean;
  password?: string;
}
