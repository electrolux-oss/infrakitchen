import { TOOL_FIELDS, TOOL_SHORT_FIELDS } from "./fragments";

export const TOOLS_QUERY = `
  query Tools($filter: JSON, $sort: [String!]) {
    tools(filter: $filter, sort: $sort) {
      ${TOOL_FIELDS}
    }
  }
`;

export const DEFAULT_TOOL_QUERY = `
  query DefaultTool {
    tools(filter: { is_default: true }) {
      ${TOOL_SHORT_FIELDS}
    }
  }
`;

export const AVAILABLE_TOOL_VERSIONS_QUERY = `
  query AvailableToolVersions($name: String!, $includePrerelease: Boolean) {
    availableToolVersions(name: $name, includePrerelease: $includePrerelease)
  }
`;
