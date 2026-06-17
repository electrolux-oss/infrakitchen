export interface BatchOperationCreateMutationInput {
  name: string;
  description?: string;
  entityType: "resource" | "executor";
  entityIds: string[];
}

export interface BatchOperationEntityIdsMutationInput {
  action: "add" | "remove";
  entityIds: string[];
}

export const CREATE_BATCH_OPERATION_MUTATION = `
  mutation CreateBatchOperation($input: BatchOperationCreateInput!) {
    createBatchOperation(input: $input) {
      id
    }
  }
`;

export const BATCH_OPERATION_ENTITY_IDS_MUTATION = `
  mutation BatchOperationEntityIds($id: UUID!, $input: BatchOperationEntityIdsInput!) {
    batchOperationEntityIds(id: $id, input: $input) {
      id
      entityIds
    }
  }
`;

export const DELETE_BATCH_OPERATION_MUTATION = `
  mutation DeleteBatchOperation($id: UUID!) {
    deleteBatchOperation(id: $id)
  }
`;
