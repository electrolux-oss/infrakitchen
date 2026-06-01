import { GqlUserShort, transformUserShort } from "../../users/graphql";

import type {
  BatchOperationGraphqlBaseField,
  BatchOperationGraphqlRelationField,
} from "./fragments";

type GqlBatchOperationBaseFieldTypes = {
  id: string;
  name: string;
  description: string;
  entityType: "resource" | "executor";
  entityIds: string[];
  createdAt: string;
  updatedAt: string;
};

type GqlBatchOperationRelationFieldTypes = {
  creator: GqlUserShort | null;
};

type GqlBatchOperationFieldTypes = GqlBatchOperationBaseFieldTypes &
  GqlBatchOperationRelationFieldTypes;

export type GqlBatchOperation = Pick<
  GqlBatchOperationFieldTypes,
  BatchOperationGraphqlBaseField | BatchOperationGraphqlRelationField
>;

export function transformBatchOperation(gql: GqlBatchOperation) {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description,
    entity_type: gql.entityType,
    entity_ids: gql.entityIds || [],
    creator: transformUserShort(gql.creator),
    created_at: gql.createdAt,
    updated_at: gql.updatedAt,
    _entity_name: "batch_operation",
  };
}
