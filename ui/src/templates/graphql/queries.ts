import { TEMPLATE_DETAIL_FIELDS, TEMPLATE_TREE_FIELDS } from "./fragments";

export const TEMPLATE_QUERY = `
  query Template($id: UUID!) {
    template(id: $id) {
      ${TEMPLATE_DETAIL_FIELDS}
    }
  }
`;

export const TEMPLATE_TREE_QUERY = `
  query TemplateTree($id: UUID!, $direction: String!) {
    templateTree(id: $id, direction: $direction) {
      ${TEMPLATE_TREE_FIELDS}
    }
  }
`;
