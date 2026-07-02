export interface GqlComponentData {
  id: string;
  name: string;
  status?: string;
  state?: string;
  updatedAt?: string;
  entityName: string;
}

export interface GqlFavorite {
  userId: string;
  componentType: string;
  componentId: string;
  createdAt: string;
  componentData: GqlComponentData | null;
}
