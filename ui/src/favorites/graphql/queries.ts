export const CREATE_FAVORITE_MUTATION = `
  mutation CreateFavorite($input: FavoriteCreateInput!) {
    createFavorite(input: $input) {
      componentType
      componentId
      createdAt
    }
  }
`;

export const DELETE_FAVORITE_MUTATION = `
  mutation DeleteFavorite($input: FavoriteDeleteInput!) {
    deleteFavorite(input: $input)
  }
`;
