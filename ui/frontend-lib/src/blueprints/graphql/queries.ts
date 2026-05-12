export const BLUEPRINT_QUERY = `
  query Blueprint($id: UUID!) {
    blueprint(id: $id) {
      id
      name
      description
      templates {
        id
        name
        cloudResourceTypes
        abstract
      }
      externalTemplates {
        id
        name
        cloudResourceTypes
        abstract
      }
      wiring
      defaultVariables
      configuration
      labels
      status
      revisionNumber
      createdBy
      creator {
        id
        identifier
      }
      workflows {
        id
        action
        status
        errorMessage
        steps {
          id
          templateId
          template {
            id
            name
          }
          resource {
            id
            name
          }
          position
          status
          errorMessage
          startedAt
          completedAt
        }
        startedAt
        completedAt
        createdAt
      }
      createdAt
      updatedAt
    }
  }
`;

export const BLUEPRINTS_QUERY = `
  query Blueprints($filter: JSON, $sort: [String!], $range: [Int!]) {
    blueprints(filter: $filter, sort: $sort, range: $range) {
      id
      name
      description
      templates {
        id
        name
        abstract
      }
      labels
      status
      updatedAt
    }
  }
`;

export const BLUEPRINTS_COUNT_QUERY = `
  query BlueprintsCount($filter: JSON) {
    blueprintsCount(filter: $filter)
  }
`;

export const BLUEPRINT_USE_QUERY = `
  query BlueprintUse($id: UUID!) {
    blueprint(id: $id) {
      id
      name
      templates {
        id
        name
        abstract
        parents {
          id
          name
          abstract
        }
      }
      externalTemplates {
        id
        name
        abstract
      }
      wiring
      configuration
    }
  }
`;
