import { ProjectPage } from "./pages/Project";
import { ProjectCreatePage } from "./pages/ProjectCreate";
import { ProjectsPage } from "./pages/Projects";

export const projectRoutes = [
  {
    path: ProjectsPage.path,
    Component: ProjectsPage,
    requiredPermission: "api:project",
    permissionAction: "read",
  },
  {
    path: ProjectCreatePage.path,
    Component: ProjectCreatePage,
    requiredPermission: "api:project",
    permissionAction: "write",
  },
  {
    path: ProjectPage.path,
    Component: ProjectPage,
    requiredPermission: "api:project",
    permissionAction: "read",
  },
];
