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
