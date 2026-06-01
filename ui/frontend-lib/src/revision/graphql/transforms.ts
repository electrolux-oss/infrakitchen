import { RevisionResponse, RevisionShort } from "../types";

export interface GqlRevisionShort {
  id: string;
  entityId: string;
  revisionNumber: number;
  createdAt: string;
}

export interface GqlRevision extends GqlRevisionShort {
  model: string;
  data: Record<string, any>;
  updatedAt: string;
}

export function transformRevisionShort(gql: GqlRevisionShort): RevisionShort {
  return {
    id: gql.id,
    entity_id: gql.entityId,
    revision_number: gql.revisionNumber,
    created_at: new Date(gql.createdAt),
    name: "",
    description: "",
  };
}

export function transformRevision(gql: GqlRevision): RevisionResponse {
  return {
    ...transformRevisionShort(gql),
    data: gql.data,
  };
}
