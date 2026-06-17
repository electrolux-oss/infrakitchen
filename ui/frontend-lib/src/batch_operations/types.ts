import { UserShort } from "../users";

export interface BatchOperation {
  id: string;
  name: string;
  description: string;
  entityType: "resource" | "executor";
  entityIds: string[];
  errorEntityIds?: Record<string, string>;
  creator: UserShort | null;
  createdAt: string;
  updatedAt: string;
  _entity_name: "batch_operation";
}

export interface BatchOperationCreate {
  name: string;
  description?: string;
  entityType: "resource" | "executor";
  entityIds: string[];
}
