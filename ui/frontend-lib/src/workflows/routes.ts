import { WorkflowPage } from "./pages/Workflow";
import { WorkflowsPage } from "./pages/Workflows";

export const workflowRoutes = [
  {
    path: WorkflowsPage.path,
    Component: WorkflowsPage,
    requiredPermission: "api:workflow",
    permissionAction: "read",
  },
  {
    path: WorkflowPage.path,
    Component: WorkflowPage,
    requiredPermission: "api:workflow",
    permissionAction: "read",
  },
];
