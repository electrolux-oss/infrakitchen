import { KubernetesWorkerConfigForm } from "./KubernetesWorkerConfigForm";
import { WorkerProviderDefinition } from "./types";

export type {
  WorkerProviderDefinition,
  WorkerProviderFormProps,
} from "./types";

/**
 * UI for each worker provider. Register a new provider here once the backend
 * exposes it in `workerProviders`.
 */
export const WORKER_PROVIDER_FORMS: Record<string, WorkerProviderDefinition> = {
  kubernetes: {
    label: "Kubernetes",
    description:
      "Spawns each worker as a pod in the cluster InfraKitchen runs in.",
    ConfigForm: KubernetesWorkerConfigForm,
  },
};

export const getWorkerProviderLabel = (provider: string): string =>
  WORKER_PROVIDER_FORMS[provider]?.label ?? provider;
