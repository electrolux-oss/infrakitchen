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
