const RESOURCE_TREE_NODE_FIELDS = `
  id
  nodeId
  name
  state
  status
  templateName
`;

// GraphQL has no recursive selections, so nest children explicitly. Keep the
// depth well above real dependency chains, otherwise deep nodes are dropped.
export function buildResourceTreeQuery(depth: number): string {
  if (depth <= 1) {
    return RESOURCE_TREE_NODE_FIELDS;
  }
  return `
    ${RESOURCE_TREE_NODE_FIELDS}
    children {
      ${buildResourceTreeQuery(depth - 1)}
    }
  `;
}

export const RESOURCE_TREE_QUERY = `
  query ResourceTree($id: UUID!, $direction: String!) {
    resourceTree(id: $id, direction: $direction) {
      ${buildResourceTreeQuery(100)}
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
  query ResourceVariableSchema($sourceCodeVersionId: UUID!, $parentResourceIds: [UUID!], $projectId: UUID) {
    resourceVariableSchema(
      sourceCodeVersionId: $sourceCodeVersionId
      parentResourceIds: $parentResourceIds
      projectId: $projectId
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
