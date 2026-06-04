import {
  BLUEPRINT_FIELDS,
  BLUEPRINT_LIST_FIELDS,
  BLUEPRINT_USE_FIELDS,
} from "./fragments";

export const BLUEPRINT_QUERY = `
  query Blueprint($id: UUID!) {
    blueprint(id: $id) {
      ${BLUEPRINT_FIELDS}
    }
  }
`;

export const BLUEPRINTS_QUERY = `
  query Blueprints($filter: JSON, $sort: [String!], $range: [Int!]) {
    blueprints(filter: $filter, sort: $sort, range: $range) {
      ${BLUEPRINT_LIST_FIELDS}
    }
    blueprintsCount(filter: $filter)
  }
`;

export const BLUEPRINT_USE_QUERY = `
  query BlueprintUse($id: UUID!) {
    blueprint(id: $id) {
      ${BLUEPRINT_USE_FIELDS}
    }
  }
`;
