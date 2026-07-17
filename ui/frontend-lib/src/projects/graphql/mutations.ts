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

export const DELETE_PROJECT_MUTATION = `
  mutation DeleteProject($id: UUID!) {
    deleteProject(id: $id)
  }
`;

export const PROJECT_ACTION_MUTATION = `
  mutation ProjectAction($id: UUID!, $input: ProjectActionInput!) {
    projectAction(id: $id, input: $input) {
      id
      name
      status
      entityName
    }
  }
`;
