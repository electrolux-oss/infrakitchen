import {
  WORKER_INSTANCE_FIELDS,
  WORKER_TEMPLATE_FIELDS,
  WORKER_TEMPLATE_SHORT_FIELDS,
} from "./fragments";

export const WORKER_TEMPLATE_QUERY = `
  query WorkerTemplate($id: UUID!) {
    workerTemplate(id: $id) {
      ${WORKER_TEMPLATE_FIELDS}
    }
  }
`;

/** Templates resources and executors can select; readable by every user. */
export const WORKER_TEMPLATE_OPTIONS_QUERY = `
  query WorkerTemplateOptions {
    workerTemplateOptions {
      ${WORKER_TEMPLATE_SHORT_FIELDS}
    }
  }
`;

export const WORKER_PROVIDERS_QUERY = `
  query WorkerProviders {
    workerProviders
  }
`;

export const WORKER_TEMPLATE_DEFAULT_CONFIGURATION_QUERY = `
  query WorkerTemplateDefaultConfiguration($provider: String!) {
    workerTemplateDefaultConfiguration(provider: $provider)
  }
`;

export const WORKER_TEMPLATE_INSTANCES_QUERY = `
  query WorkerTemplateInstances($id: UUID!) {
    workerTemplateInstances(id: $id) {
      error
      instances {
        ${WORKER_INSTANCE_FIELDS}
      }
    }
  }
`;

export const WORKER_INSTANCE_LOGS_QUERY = `
  query WorkerInstanceLogs($id: UUID!, $instanceId: String!, $tail: Int) {
    workerInstanceLogs(id: $id, instanceId: $instanceId, tail: $tail) {
      logs
      error
    }
  }
`;

export const WORKER_INSTANCE_MANIFEST_QUERY = `
  query WorkerInstanceManifest($id: UUID!, $instanceId: String!) {
    workerInstanceManifest(id: $id, instanceId: $instanceId) {
      manifest
      error
    }
  }
`;

export const WORKER_LOGS_QUERY = `
  query WorkerLogs($id: UUID!, $tail: Int) {
    workerLogs(id: $id, tail: $tail) {
      logs
      error
    }
  }
`;
