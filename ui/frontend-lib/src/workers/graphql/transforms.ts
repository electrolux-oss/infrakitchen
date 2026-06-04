export interface GqlWorker {
  id: string;
  name: string;
  host: string;
  hostMetadata: Record<string, any> | null;
  status: string;
  currentTask: Record<string, any> | null;
  tasksCompleted: number | null;
  createdAt: string;
  updatedAt: string;
}

export function transformWorker(gql: GqlWorker) {
  return {
    id: gql.id,
    name: gql.name,
    host: gql.host,
    host_metadata: gql.hostMetadata ?? {},
    status: gql.status,
    current_task: gql.currentTask,
    tasks_completed: gql.tasksCompleted ?? 0,
    created_at: new Date(gql.createdAt),
    updated_at: new Date(gql.updatedAt),
    _entity_name: "worker",
  };
}
