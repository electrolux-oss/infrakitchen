export interface BatchOperationCreate {
  name: string;
  description?: string;
  entityType: "resource" | "executor";
  entityIds: string[];
}
