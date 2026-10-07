export interface GqlWorker {
  id: string;
  name: string;
  host: string;
  // Free-form JSON blob; inner keys are stored as-is (snake_case).
  hostMetadata: Record<string, any> | null;
  status: string;
  // Free-form JSON blob; inner keys are stored as-is (snake_case).
  currentTask: Record<string, any> | null;
  tasksCompleted: number | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskWaitingReason =
  | "entity_busy"
  | "retry_delay"
  | "cancel_window"
  | "no_workers"
  | "workers_busy"
  | "pending_pickup";

export interface GqlQueuedTask {
  id: string;
  entity: string;
  action: string | null;
  status: "queued" | "running";
  createdAt: string;
  availableAt: string | null;
  startedAt: string | null;
  retries: number;
  maxRetries: number;
  position: number | null;
  workerHost: string | null;
  creatorId: string | null;
  creatorName: string | null;
  waitingReason: TaskWaitingReason | null;
}

export interface GqlEntityQueueStatus {
  workersFree: number;
  workersOnline: number;
  tasks: GqlQueuedTask[];
}
