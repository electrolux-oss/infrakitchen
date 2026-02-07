import { UserShort } from "../users";

export interface BatchOperation {
  id: string;
  name: string;
  description: string;
  entity_type: "resource" | "executor";
  entity_ids: string[];
  error_entity_ids?: Record<string, string>;
  creator: UserShort | null;
  created_at: string;
  updated_at: string;
  _entity_name: "batch_operation";
}

export interface BatchOperationCreate {
  name: string;
  description?: string;
  entity_type: "resource" | "executor";
  entity_ids: string[];
}
