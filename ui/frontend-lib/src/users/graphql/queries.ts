import { USER_FIELDS } from "./fragments";

export const USER_QUERY = `
  query User($id: UUID!) {
    user(id: $id) {
      ${USER_FIELDS}
    }
  }
`;
