import { SECRET_DETAIL_FIELDS } from "./fragments";

export const SECRET_QUERY = `
  query Secret($id: UUID!) {
    secret(id: $id) {
      ${SECRET_DETAIL_FIELDS}
    }
  }
`;
