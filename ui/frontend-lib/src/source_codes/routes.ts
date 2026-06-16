import { SourceCodePage } from "./pages/SourceCode";
import { SourceCodeCreatePage } from "./pages/SourceCodeCreate";
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
    path: SourceCodeCreatePage.path,
    Component: SourceCodeCreatePage,
    requiredPermission: "api:source_code",
    permissionAction: "write",
  },
];
