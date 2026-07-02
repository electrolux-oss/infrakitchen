export const RESOURCE_TREE_QUERY = `
  query ResourceTree($id: UUID!, $direction: String!) {
    resourceTree(id: $id, direction: $direction) {
      id
      nodeId
      name
      state
      status
      templateName
      children {
        id
        nodeId
        name
        state
        status
        templateName
        children {
          id
          nodeId
          name
          state
          status
          templateName
          children {
            id
            nodeId
            name
            state
            status
            templateName
            children {
              id
              nodeId
              name
              state
              status
              templateName
            }
          }
        }
      }
    }
  }
`;

export const RESOURCE_METADATA_QUERY = `
  query ResourceMetadata($id: UUID!) {
    resourceMetadata(id: $id)
  }
`;

export const RESOURCE_DOWNLOAD_QUERY = `
  query ResourceDownload($id: UUID!) {
    resourceDownload(id: $id) {
      filename
      contentType
      contentBase64
    }
  }
`;

export const RESOURCE_VARIABLE_SCHEMA_QUERY = `
  query ResourceVariableSchema($sourceCodeVersionId: UUID!, $parentResourceIds: [UUID!]) {
    resourceVariableSchema(
      sourceCodeVersionId: $sourceCodeVersionId
      parentResourceIds: $parentResourceIds
    ) {
      name
      type
      description
      options
      required
      restricted
      sensitive
      frozen
      unique
      value
      index
    }
  }
`;
