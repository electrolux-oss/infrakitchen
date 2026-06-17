import { IkEntity } from "../types";

export interface FavoriteResource
  extends Omit<IkEntity, "created_at" | "updated_at"> {
  id: string;
  name: string;
  type?: string;
  status: string;
  state: string;
  updatedAt?: string;
  createdAt?: string;
  _component_type: "resource" | "executor";
  [key: string]: any;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  creator?: {
    id: string;
    identifier: string;
    displayName?: string;
  } | null;
  model: string;
  entityId: string;
  createdAt: string | Date;
  entityData?: {
    name?: string;
    status?: string;
  };
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
