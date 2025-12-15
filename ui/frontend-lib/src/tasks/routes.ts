import { TasksPage } from "./pages/Tasks";

export const taskRoutes = [
  {
    path: TasksPage.path,
    Component: TasksPage,
    requiredPermission: "api:task",
    permissionAction: "read",
  },
];
