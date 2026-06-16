import { SourceCodeVersionPage } from "./pages/SourceCodeVersion";
import { SourceCodeVersionCreatePage } from "./pages/SourceCodeVersionCreate";
import { SourceCodeVersionsPage } from "./pages/SourceCodeVersions";

export const sourceCodeVersionRoutes = [
  {
    path: SourceCodeVersionsPage.path,
    Component: SourceCodeVersionsPage,
    requiredPermission: "api:source_code_version",
    permissionAction: "read",
  },
  {
    path: SourceCodeVersionPage.path,
    Component: SourceCodeVersionPage,
    requiredPermission: "api:source_code_version",
    permissionAction: "read",
  },
  {
    path: SourceCodeVersionCreatePage.path,
    Component: SourceCodeVersionCreatePage,
    requiredPermission: "api:source_code_version",
    permissionAction: "write",
  },
];
