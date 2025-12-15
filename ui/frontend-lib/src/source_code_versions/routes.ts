import { SourceCodeVersionPage } from "./pages/SourceCodeVersion";
import { SourceCodeVersionActivityPage } from "./pages/SourceCodeVersionActivity";
import { SourceCodeVersionConfigPage } from "./pages/SourceCodeVersionConfig";
import { SourceCodeVersionCreatePage } from "./pages/SourceCodeVersionCreate";
import { SourceCodeVersionEditPage } from "./pages/SourceCodeVersionEdit";
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
  {
    path: SourceCodeVersionActivityPage.path,
    Component: SourceCodeVersionActivityPage,
    requiredPermission: "api:source_code_version",
    permissionAction: "read",
  },
  {
    path: SourceCodeVersionEditPage.path,
    Component: SourceCodeVersionEditPage,
    requiredPermission: "api:source_code_version",
    permissionAction: "write",
  },
  {
    path: SourceCodeVersionConfigPage.path,
    Component: SourceCodeVersionConfigPage,
    requiredPermission: "api:source_code_version",
    permissionAction: "write",
  },
];
