import { UserShort } from "../users";

export interface TaskResponse {
  id: string;
  entity: string;
  entityId: string;
  state: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  entityData?: Record<string, any> | null;
  creator: UserShort | null;
  _entity_name: string;
}
