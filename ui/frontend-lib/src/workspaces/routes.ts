import { WorkspacePage } from "./pages/Workspace";
import { WorkspaceCreatePage } from "./pages/WorkspaceCreate";
import { WorkspaceEditPage } from "./pages/WorkspaceEdit";
import { WorkspacesPage } from "./pages/Workspaces";

export const workspaceRoutes = [
  {
    path: WorkspacesPage.path,
    Component: WorkspacesPage,
    requiredPermission: "api:workspace",
    permissionAction: "read",
  },
  {
    path: WorkspaceCreatePage.path,
    Component: WorkspaceCreatePage,
    requiredPermission: "api:workspace",
    permissionAction: "write",
  },
  {
    path: WorkspacePage.path,
    Component: WorkspacePage,
    requiredPermission: "api:workspace",
    permissionAction: "read",
  },
  {
    path: WorkspaceEditPage.path,
    Component: WorkspaceEditPage,
    requiredPermission: "api:workspace",
    permissionAction: "write",
  },
];
