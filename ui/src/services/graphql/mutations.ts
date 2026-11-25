import { ServiceUpdateRequest } from "../types";

export type ServiceUpdateFieldInput = Partial<ServiceUpdateRequest>;

export const CREATE_SERVICE_MUTATION = `
  mutation CreateService($input: ServiceCreateInput!) {
    createService(input: $input) {
      id
      name
      entityName
    }
  }
`;

export const UPDATE_SERVICE_MUTATION = `
  mutation UpdateService($id: UUID!, $input: ServiceUpdateInput!) {
    updateService(id: $id, input: $input) {
      id
      name
      entityName
    }
  }
`;

export const BUILD_SERVICE_MUTATION = `
  mutation BuildService($serviceId: UUID!, $commitSha: String!, $tag: String) {
    buildService(serviceId: $serviceId, commitSha: $commitSha, tag: $tag) {
      id
      commitSha
      status
    }
  }
`;

export const ADD_SERVICE_REGISTRY_MUTATION = `
  mutation AddServiceRegistry(
    $serviceId: UUID!
    $registryIntegrationId: UUID!
    $imageRepository: String!
  ) {
    addServiceRegistry(
      serviceId: $serviceId
      registryIntegrationId: $registryIntegrationId
      imageRepository: $imageRepository
    ) {
      id
    }
  }
`;

export const REMOVE_SERVICE_REGISTRY_MUTATION = `
  mutation RemoveServiceRegistry($serviceId: UUID!, $id: UUID!) {
    removeServiceRegistry(serviceId: $serviceId, id: $id) {
      id
    }
  }
`;

export const ADD_SERVICE_BASE_IMAGE_REGISTRY_MUTATION = `
  mutation AddServiceBaseImageRegistry($serviceId: UUID!, $integrationId: UUID!) {
    addServiceBaseImageRegistry(serviceId: $serviceId, integrationId: $integrationId) {
      id
    }
  }
`;

export const REMOVE_SERVICE_BASE_IMAGE_REGISTRY_MUTATION = `
  mutation RemoveServiceBaseImageRegistry($serviceId: UUID!, $integrationId: UUID!) {
    removeServiceBaseImageRegistry(serviceId: $serviceId, integrationId: $integrationId) {
      id
    }
  }
`;

export const SYNC_SERVICE_SOURCE_CODE_MUTATION = `
  mutation SyncServiceSourceCode($id: UUID!) {
    syncServiceSourceCode(id: $id) {
      id
      status
      updatedAt
    }
  }
`;

export const CREATE_SERVICE_SUBSCRIPTION_MUTATION = `
  mutation CreateServiceSubscription($input: ServiceSubscriptionCreateInput!) {
    createServiceSubscription(input: $input) {
      id
    }
  }
`;

export const DELETE_SERVICE_SUBSCRIPTION_MUTATION = `
  mutation DeleteServiceSubscription($input: ServiceSubscriptionDeleteInput!) {
    deleteServiceSubscription(input: $input)
  }
`;
