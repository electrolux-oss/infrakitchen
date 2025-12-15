import { SourceCodePage } from "./pages/SourceCode";
import { SourceCodeActivityPage } from "./pages/SourceCodeActivity";
import { SourceCodeCreatePage } from "./pages/SourceCodeCreate";
import { SourceCodeEditPage } from "./pages/SourceCodeEdit";
import { SourceCodesPage } from "./pages/SourceCodes";

export const sourceCodeRoutes = [
  {
    path: SourceCodesPage.path,
    Component: SourceCodesPage,
    requiredPermission: "api:source_code",
    permissionAction: "read",
  },
  {
    path: SourceCodePage.path,
    Component: SourceCodePage,
    requiredPermission: "api:source_code",
    permissionAction: "read",
  },
  {
    path: SourceCodeActivityPage.path,
    Component: SourceCodeActivityPage,
    requiredPermission: "api:source_code",
    permissionAction: "read",
  },
  {
    path: SourceCodeCreatePage.path,
    Component: SourceCodeCreatePage,
    requiredPermission: "api:source_code",
    permissionAction: "write",
  },
  {
    path: SourceCodeEditPage.path,
    Component: SourceCodeEditPage,
    requiredPermission: "api:source_code",
    permissionAction: "write",
  },
];
