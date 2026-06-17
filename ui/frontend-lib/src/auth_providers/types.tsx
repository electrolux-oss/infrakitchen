import { UserShort } from "../users/types";

export interface AuthProviderShort {
  id: string;
  name: string;
}

export interface AuthProviderResponse extends AuthProviderShort {
  createdAt: Date;
  updatedAt: Date;
  creator: UserShort | null;
  description: string;
  enabled: boolean;
  authProvider:
    | "microsoft"
    | "guest"
    | "github"
    | "gitlab"
    | "backstage"
    | "ik_service_account";
  configuration: object;
  filterByDomain: string[];
  _entity_name: string;
}

export type AuthProviderResponseOptional = Partial<AuthProviderResponse>;

export interface AuthProviderCreate {
  name: string;
  description: string;
  configuration: object;
  authProvider:
    | "microsoft"
    | "guest"
    | "github"
    | "gitlab"
    | "backstage"
    | "ik_service_account"
    | "";
  filterByDomain: string[];
  enabled: boolean;
}

export interface AuthProviderUpdate {
  name: string;
  description: string;
  configuration: object;
  filterByDomain: string[];
  enabled: boolean;
}
