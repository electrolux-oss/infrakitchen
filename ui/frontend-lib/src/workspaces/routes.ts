import { WorkspacePage } from "./pages/Workspace";
import { WorkspaceActivityPage } from "./pages/WorkspaceActivity";
import { WorkspaceCreatePage } from "./pages/WorkspaceCreate";
import { WorkspaceEditPage } from "./pages/WorkspaceEdit";
import { WorkspaceMetadataPage } from "./pages/WorkspaceMetadata";
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
  {
    path: WorkspaceActivityPage.path,
    Component: WorkspaceActivityPage,
    requiredPermission: "api:workspace",
    permissionAction: "read",
  },
  {
    path: WorkspaceMetadataPage.path,
    Component: WorkspaceMetadataPage,
    requiredPermission: "api:workspace",
    permissionAction: "read",
  },
];
