export interface Creator {
  id: string;
  identifier: string;
  display_name: string;
}

export interface AuditLogsResponse {
  id: string;
  model: string;
  user_id: string;
  action: string;
  entity_id: string;
  created_at: Date;
  creator: Creator;
}
