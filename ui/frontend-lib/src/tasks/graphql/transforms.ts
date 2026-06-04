import { GqlUserShort, transformUserShort } from "../../users/graphql";

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

export function transformTask(gql: GqlTask) {
  return {
    id: gql.id,
    entity: gql.entity,
    entity_id: gql.entityId,
    state: gql.state,
    status: gql.status,
    created_at: gql.createdAt,
    updated_at: gql.updatedAt,
    entity_data: gql.entityData,
    creator: transformUserShort(gql.creator),
    _entity_name: "task",
  };
}
