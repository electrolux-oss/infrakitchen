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
