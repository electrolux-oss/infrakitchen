import { GqlUserShort } from "../../users/graphql";

import type {
  WorkerTemplateGraphqlBaseField,
  WorkerTemplateGraphqlRelationField,
} from "./fragments";

export interface KubernetesWorkerConfiguration {
  provider: "kubernetes";
  pod_manifest: string;
  namespace: string | null;
}

export interface DockerWorkerConfiguration {
  provider: "docker";
  docker_host: string;
  image: string | null;
  command: string[];
  network: string | null;
  env: Record<string, string>;
  volumes: string[];
  memory: string | null;
  cpus: number | null;
  extra_hosts: string[];
}

/** Provider specific configuration, stored with snake_case keys. */
export type WorkerConfiguration =
  KubernetesWorkerConfiguration | DockerWorkerConfiguration;

type GqlWorkerTemplateBaseFieldTypes = {
  id: string;
  name: string;
  description: string;
  provider: string;
  configuration: WorkerConfiguration;
  maxWorkers: number;
  idleTimeoutSeconds: number;
  priority: number;
  lastError: string | null;
  labels: string[];
  status: string;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
  entityName: string;
};

type GqlWorkerTemplateRelationFieldTypes = {
  creator: GqlUserShort | null;
};

type GqlWorkerTemplateFieldTypes = GqlWorkerTemplateBaseFieldTypes &
  GqlWorkerTemplateRelationFieldTypes;

export type GqlWorkerTemplate = Pick<
  GqlWorkerTemplateFieldTypes,
  WorkerTemplateGraphqlBaseField | WorkerTemplateGraphqlRelationField
>;

export type WorkerInstancePhase =
  "pending" | "running" | "succeeded" | "failed" | "unknown";

export interface GqlWorkerInstance {
  id: string;
  host: string;
  phase: WorkerInstancePhase;
  createdAt: string | null;
  finishedAt: string | null;
  reason: string | null;
  details: Record<string, any> | null;
  workerId: string | null;
  workerStatus: string | null;
  currentTask: Record<string, string> | null;
  tasksCompleted: number | null;
}

export interface GqlWorkerInstances {
  error: string | null;
  instances: GqlWorkerInstance[];
}

export interface GqlWorkerInstanceLogs {
  logs: string;
  error: string | null;
}

export interface GqlWorkerInstanceManifest {
  manifest: Record<string, any> | null;
  error: string | null;
}
