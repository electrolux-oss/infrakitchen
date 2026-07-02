import { GqlUserShort } from "../../users/graphql";

export interface GqlTask {
  id: string;
  entity: string;
  entityId: string;
  entityName: string;
  state: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  entityData?: Record<string, any> | null;
  creator: GqlUserShort | null;
}
