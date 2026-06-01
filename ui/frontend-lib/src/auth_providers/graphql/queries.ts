import { AUTH_PROVIDER_FIELDS } from "./fragments";

export const AUTH_PROVIDER_QUERY = `
  query AuthProvider($id: UUID!) {
    authProvider(id: $id) {
      ${AUTH_PROVIDER_FIELDS}
    }
  }
`;
