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

export const DELETE_SERVICE_MUTATION = `
  mutation DeleteService($id: UUID!) {
    deleteService(id: $id)
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
