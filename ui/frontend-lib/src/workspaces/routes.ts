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
  },
  {
    path: WorkspaceCreatePage.path,
    Component: WorkspaceCreatePage,
  },
  {
    path: WorkspacePage.path,
    Component: WorkspacePage,
  },
  {
    path: WorkspaceEditPage.path,
    Component: WorkspaceEditPage,
  },
  {
    path: WorkspaceActivityPage.path,
    Component: WorkspaceActivityPage,
  },
  {
    path: WorkspaceMetadataPage.path,
    Component: WorkspaceMetadataPage,
  },
];
