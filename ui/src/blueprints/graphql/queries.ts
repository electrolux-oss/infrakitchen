import { BLUEPRINT_FIELDS, BLUEPRINT_USE_FIELDS } from "./fragments";

export const BLUEPRINT_QUERY = `
  query Blueprint($id: UUID!) {
    blueprint(id: $id) {
      ${BLUEPRINT_FIELDS}
    }
  }
`;

export const BLUEPRINT_USE_QUERY = `
  query BlueprintUse($id: UUID!) {
    blueprint(id: $id) {
      ${BLUEPRINT_USE_FIELDS}
    }
  }
`;

export const BLUEPRINT_USE_VARIABLE_SCHEMA_QUERY = `
  query BlueprintUseVariableSchema($sourceCodeVersionId: UUID!, $parentResourceIds: [UUID!]) {
    resourceVariableSchema(
      sourceCodeVersionId: $sourceCodeVersionId
      parentResourceIds: $parentResourceIds
    ) {
      name
      type
      description
      options
      required
      frozen
      unique
      sensitive
      restricted
      value
      index
      validationRules {
        id
        targetType
        description
        minValue
        maxValue
        regexPattern
        maxLength
      }
    }
  }
`;

export const BLUEPRINT_USE_SOURCE_CODE_VERSIONS_QUERY = `
  query BlueprintUseSourceCodeVersions($filter: JSON, $sort: [String!], $range: [Int!]) {
    sourceCodeVersions(filter: $filter, sort: $sort, range: $range) {
      id
      identifier
      entityName
      sourceCodeVersion
      sourceCodeBranch
      status
      template {
        id
        name
      }
      sourceCode {
        id
        sourceCodeUrl
        sourceCodeProvider
        entityName
      }
    }
  }
`;
