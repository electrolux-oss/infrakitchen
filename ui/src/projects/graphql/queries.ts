import { PROJECT_DETAIL_FIELDS } from "./fragments";

export const PROJECT_QUERY = `
  query Project($id: UUID!) {
    project(id: $id) {
      ${PROJECT_DETAIL_FIELDS}
    }
  }
`;
