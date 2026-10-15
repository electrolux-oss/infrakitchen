import { GqlUserShort } from "../../users/graphql";

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
  entityName: string;
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
