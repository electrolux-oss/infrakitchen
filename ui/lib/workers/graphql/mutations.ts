export const CANCEL_QUEUED_TASK_MUTATION = `
  mutation CancelQueuedTask($id: UUID!) {
    cancelQueuedTask(id: $id) {
      id
      status
    }
  }
`;
