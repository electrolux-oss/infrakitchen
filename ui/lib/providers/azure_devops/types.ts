export interface AzureDevopsProject {
  id: string;
  name: string;
  description?: string | null;
  url: string;
  state: string;
  revision: number;
  visibility: string;
  lastUpdateTime: string;
}

export interface AzureDevopsRepo {
  id: string;
  name: string;
  url: string;
  project: AzureDevopsProject;
  description?: string | null;
  ssh_url?: string | null;
  remoteUrl?: string | null;
  remote_url?: string | null;
  size?: number | null;
  default_branch?: string | null;
  isDisabled?: boolean;
  is_disabled?: boolean;
  isInMaintenance?: boolean | null;
  last_update_time?: string | null;
}
