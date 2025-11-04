import { UserResponse } from "../users/types";

export interface AuthProviderShort {
  id: string;
  name: string;
}

export interface AuthProviderResponse extends AuthProviderShort {
  created_at: Date;
  updated_at: Date;
  creator: UserResponse | null;
  description: string;
  enabled: boolean;
  auth_provider:
    | "microsoft"
    | "guest"
    | "github"
    | "backstage"
    | "ik_service_account";
  configuration: object;
  filter_by_domain: string[];
}

export interface AuthProviderCreate {
  name: string;
  description: string;
  configuration: object;
  auth_provider:
    | "microsoft"
    | "guest"
    | "github"
    | "backstage"
    | "ik_service_account"
    | "";
  filter_by_domain: string[];
  enabled: boolean;
}

export interface AuthProviderUpdate {
  name: string;
  description: string;
  configuration: object;
  filter_by_domain: string[];
  enabled: boolean;
}
