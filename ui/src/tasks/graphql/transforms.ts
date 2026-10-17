import { GqlUserShort } from "../../users/graphql";

export interface GqlTask {
  id: string;
  entity: string;
  entityId: string;
  entityName: string;
  runAt: string | null;
  state: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  entityData?: Record<string, any> | null;
  creator: GqlUserShort | null;
}

export interface GqlTaskQueueItem {
  id: string;
  entity: string;
  entityId: string | null;
  entityData: Record<string, any> | null;
  action: string | null;
  status: "queued" | "running";
  createdAt: string;
  startedAt: string | null;
  availableAt: string | null;
  retries: number;
  maxRetries: number;
  workerHost: string | null;
  creator: { id: string; identifier: string } | null;
}
