import { PermissionPage } from "./pages/Permission";
import { PermissionActivityPage } from "./pages/PermissionActivity";

export const permissionRoutes = [
  {
    path: PermissionPage.path,
    Component: PermissionPage,
    requiredPermission: "api:permission",
    permissionAction: "read",
  },
  {
    path: PermissionActivityPage.path,
    Component: PermissionActivityPage,
    requiredPermission: "api:permission",
    permissionAction: "read",
  },
];
