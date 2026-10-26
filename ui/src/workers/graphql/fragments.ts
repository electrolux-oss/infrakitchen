import { GraphqlFieldMap } from "../../common/graphql/buildGraphqlFields";

export const WORKER_FIELD_MAP: GraphqlFieldMap = {};

/**
 * Selection for the queued/running tasks of an entity. Entity pages append it to
 * their detail fields so the queue state arrives with the entity in one request.
 */
export const TASK_QUEUE_STATUS_SELECTION = `
  taskQueueStatus {
    workersFree
    workersOnline
    tasks {
      id
      entity
      action
      status
      createdAt
      availableAt
      startedAt
      retries
      maxRetries
      position
      workerHost
      creatorId
      creatorName
      waitingReason
    }
  }
`;
