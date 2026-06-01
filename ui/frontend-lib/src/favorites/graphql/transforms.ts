export interface GqlComponentData {
  id: string;
  name: string;
  status?: string;
  state?: string;
  updated_at?: string;
  _entity_name: string;
}

export interface GqlFavorite {
  userId: string;
  componentType: string;
  componentId: string;
  createdAt: string;
  componentData: GqlComponentData | null;
}

export function transformFavorite(gql: GqlFavorite) {
  return {
    user_id: gql.userId,
    component_type: gql.componentType,
    component_id: gql.componentId,
    created_at: gql.createdAt,
    component_data: gql.componentData,
  };
}
