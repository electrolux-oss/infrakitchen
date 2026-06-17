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
    entityType: gql.entityType,
    entityIds: gql.entityIds || [],
    creator: transformUserShort(gql.creator),
    createdAt: gql.createdAt,
    updatedAt: gql.updatedAt,
    _entity_name: "batch_operation",
  };
}
