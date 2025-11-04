export enum ENTITY_STATE {
  PROVISION = "provision",
  PROVISIONED = "provisioned",
  DESTROY = "destroy",
  DESTROYED = "destroyed",
  UPDATE = "update",
}

export enum ENTITY_STATUS {
  QUEUED = "queued",
  IN_PROGRESS = "in_progress",
  DONE = "done",
  ENABLED = "enabled",
  ERROR = "error",
  UNKNOWN = "unknown",
  APPROVAL_PENDING = "approval_pending",
  PENDING = "pending",
  REJECTED = "rejected",
  DISABLED = "disabled",
  READY = "ready",
}

export enum ENTITY_ACTION {
  CREATE = "create",
  DESTROY = "destroy",
  DELETE = "delete",
  REJECT = "reject",
  APPROVE = "approve",
  EXECUTE = "execute",
  RETRY = "retry",
  RECREATE = "recreate",
  SYNC = "sync",
  DRYRUN = "dryrun",
  DRYRUN_WITH_TEMP_STATE = "dryrun_with_temp_state",
  DISABLE = "disable",
  ENABLE = "enable",
  HAS_TEMPORARY_STATE = "has_temporary_state",
}

export enum INTEGRATION_STATUS {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  PENDING = "pending",
  ERROR = "error",
}

export enum WORKER_STATUS {
  FREE = "free",
  BUSY = "busy",
}
