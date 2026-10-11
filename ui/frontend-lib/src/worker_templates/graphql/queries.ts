import { WORKER_TEMPLATE_DETAIL_FIELDS } from "./fragments";

export const WORKER_TEMPLATE_QUERY = `
  query WorkerTemplate($id: UUID!) {
    workerTemplate(id: $id) {
      ${WORKER_TEMPLATE_DETAIL_FIELDS}
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
      instances {
        id
        host
        phase
        createdAt
        details
      }
      error
    }
  }
`;
