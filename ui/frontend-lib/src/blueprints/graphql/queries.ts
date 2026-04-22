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
