import { ProjectUpdateRequest } from "../types";

export type ProjectUpdateFieldInput = Partial<ProjectUpdateRequest>;

export const CREATE_PROJECT_MUTATION = `
  mutation CreateProject($input: ProjectCreateInput!) {
    createProject(input: $input) {
      id
      name
      entityName
    }
  }
`;

export const UPDATE_PROJECT_MUTATION = `
  mutation UpdateProject($id: UUID!, $input: ProjectUpdateInput!) {
    updateProject(id: $id, input: $input) {
      id
      name
      entityName
    }
  }
`;
