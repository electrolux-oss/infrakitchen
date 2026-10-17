/** Tasks waiting for or running on a worker, oldest first, plus their total count. */
export const ACTIVE_TASK_QUEUE_QUERY = `
  query ActiveTaskQueue($filter: JSON, $sort: [String!], $range: [Int!]) {
    taskQueueItems(filter: $filter, sort: $sort, range: $range) {
      id
      entity
      entityId
      entityData
      action
      status
      createdAt
      startedAt
      availableAt
      retries
      maxRetries
      workerHost
      creator
    }
    taskQueueItemsCount(filter: $filter)
  }
`;

export const ACTIVE_TASK_QUEUE_COUNT_QUERY = `
  query ActiveTaskQueueCount($filter: JSON) {
    taskQueueItemsCount(filter: $filter)
  }
`;

export const ACTIVE_TASK_QUEUE_FILTER = { status__in: ["queued", "running"] };
