import { FAVORITE_FIELDS } from "./fragments";

export const FAVORITES_QUERY = `
  query Favorites {
    favorites {
      ${FAVORITE_FIELDS}
    }
  }
`;
