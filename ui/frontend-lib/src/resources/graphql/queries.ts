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
