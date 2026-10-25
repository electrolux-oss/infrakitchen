const TASK_QUEUE_ITEM_FIELDS = `
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
  createdBy
  workerId
  workerHost
  creator
`;

/** Tasks waiting for or running on a worker, oldest first, plus their total count. */
export const ACTIVE_TASK_QUEUE_QUERY = `
  query ActiveTaskQueue($filter: JSON, $sort: [String!], $range: [Int!]) {
    taskQueueItems(filter: $filter, sort: $sort, range: $range) {
      ${TASK_QUEUE_ITEM_FIELDS}
    }
    taskQueueItemsCount(filter: $filter)
  }
`;

/** Details for queue items first seen in an event (which only carries their columns). */
export const TASK_QUEUE_ITEMS_BY_ID_QUERY = `
  query TaskQueueItemsById($filter: JSON) {
    taskQueueItems(filter: $filter) {
      ${TASK_QUEUE_ITEM_FIELDS}
    }
  }
`;

export const ACTIVE_TASK_QUEUE_FILTER = { status__in: ["queued", "running"] };
