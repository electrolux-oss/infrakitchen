import { WorkflowPage } from "./pages/Workflow";
import { WorkflowEditPage } from "./pages/WorkflowEdit";
import { WorkflowsPage } from "./pages/Workflows";

export const workflowRoutes = [
  {
    path: WorkflowsPage.path,
    Component: WorkflowsPage,
    requiredPermission: "api:workflow",
    permissionAction: "read",
  },
  {
    path: WorkflowEditPage.path,
    Component: WorkflowEditPage,
    requiredPermission: "api:workflow",
    permissionAction: "write",
  },
  {
    path: WorkflowPage.path,
    Component: WorkflowPage,
    requiredPermission: "api:workflow",
    permissionAction: "read",
  },
];
