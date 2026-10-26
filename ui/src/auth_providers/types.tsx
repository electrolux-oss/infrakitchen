export interface AuthProviderCreate {
  name: string;
  description: string;
  configuration: object;
  authProvider:
    | "microsoft"
    | "guest"
    | "github"
    | "google"
    | "gitlab"
    | "backstage"
    | "ik_service_account"
    | "";
  filterByDomain: string[];
  enabled: boolean;
}
