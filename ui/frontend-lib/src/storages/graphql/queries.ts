import { STORAGE_DETAIL_FIELDS } from "./fragments";

export const STORAGE_QUERY = `
  query Storage($id: UUID!) {
    storage(id: $id) {
      ${STORAGE_DETAIL_FIELDS}
    }
  }
`;
