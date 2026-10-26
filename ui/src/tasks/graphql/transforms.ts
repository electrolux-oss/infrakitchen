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
  createdBy: string | null;
  workerId: string | null;
  workerHost: string | null;
  creator: { id: string; identifier: string } | null;
}

export type ActiveTaskStatus = "queued" | "running";

/**
 * A queued or running task as kept by the task queue store. Events carry the
 * queue columns; the optional details come from queries and are kept across events.
 */
export interface QueueTask {
  id: string;
  entity: string;
  entityId: string | null;
  action: string | null;
  status: ActiveTaskStatus;
  createdAt: string;
  availableAt: string | null;
  startedAt: string | null;
  retries: number;
  maxRetries: number;
  createdBy: string | null;
  workerId: string | null;
  entityData?: Record<string, any> | null;
  creatorName?: string | null;
  workerHost?: string | null;
  /** Place among queued tasks; only known right after a query. */
  position?: number | null;
}
