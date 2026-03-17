export interface TaskResponse {
  id: string;
  entity: string;
  entity_id: string;
  state: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  created_by: { id: string; identifier: string; _entity_name: string } | string;
  _entity_name: string;
}
