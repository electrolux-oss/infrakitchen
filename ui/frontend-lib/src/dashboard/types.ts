import { IkEntity } from "../types";

export interface FavoriteResource extends IkEntity {
  id: string;
  name: string;
  type?: string;
  status?: string;
  state?: string;
  updated_at?: string;
  created_at?: string;
  _component_type: "resource" | "executor";
  [key: string]: any;
}

export interface ActivityLogEntry extends IkEntity {
  id: string;
  action: string;
  creator?: {
    id: string;
    identifier: string;
    display_name?: string;
  };
  model: string;
  entity_id: string;
  created_at: string;
  status?: "success" | "failure" | "pending";
  [key: string]: any;
}

export interface DashboardContextType {
  favorites: FavoriteResource[];
  activities: ActivityLogEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
