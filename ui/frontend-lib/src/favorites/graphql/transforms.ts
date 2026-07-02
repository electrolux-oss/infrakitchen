export interface GqlComponentData {
  id: string;
  name: string;
  status?: string;
  state?: string;
  updatedAt?: string;
  _entity_name: string;
}

export interface GqlFavorite {
  userId: string;
  componentType: string;
  componentId: string;
  createdAt: string;
  componentData: GqlComponentData | null;
}
