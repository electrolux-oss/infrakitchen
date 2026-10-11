export interface WorkerTemplateCreate {
  name: string;
  description: string;
  provider: string;
  configuration: Record<string, any>;
  maxWorkers: number;
  idleTimeoutSeconds: number;
  priority: number;
  labels: string[];
}

export interface WorkerTemplateValidationResult {
  isValid: boolean;
  message: string | null;
}
