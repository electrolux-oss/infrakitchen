export interface RevisionShort extends Record<string, any> {
  id: string;
  entity_id: string;
  revision_number: number;
  created_at: Date;
  name: string;
  description: string;
}

export interface RevisionResponse extends RevisionShort {
  data: Record<string, any>;
}
