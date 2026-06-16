import { GqlUserShort, transformUserShort } from "../../users/graphql";
import { TaskResponse } from "../types";

export interface GqlTask {
  id: string;
  entity: string;
  entityId: string;
  state: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  entityData?: Record<string, any> | null;
  creator: GqlUserShort | null;
}

export function transformTask(gql: GqlTask): TaskResponse {
  return {
    id: gql.id,
    entity: gql.entity,
    entityId: gql.entityId,
    state: gql.state,
    status: gql.status,
    createdAt: gql.createdAt,
    updatedAt: gql.updatedAt,
    entityData: gql.entityData,
    creator: transformUserShort(gql.creator),
    _entity_name: "task",
  };
}
