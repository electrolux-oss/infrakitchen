export const DOWNLOAD_TOOL_MUTATION = `
  mutation DownloadTool($input: ToolDownloadInput!) {
    downloadTool(input: $input) {
      id
      status
    }
  }
`;

export const DELETE_TOOL_MUTATION = `
  mutation DeleteTool($id: UUID!) {
    deleteTool(id: $id)
  }
`;

export const TOOL_ACTION_MUTATION = `
  mutation ToolAction($id: UUID!, $input: ToolActionInput!) {
    toolAction(id: $id, input: $input) {
      id
      status
    }
  }
`;

export const SET_DEFAULT_TOOL_MUTATION = `
  mutation SetDefaultTool($id: UUID) {
    setDefaultTool(id: $id) {
      id
      isDefault
    }
  }
`;
