import { PermissionPage } from "./pages/Permission";
import { PermissionActivityPage } from "./pages/PermissionActivity";

export const permissionRoutes = [
  {
    path: PermissionPage.path,
    Component: PermissionPage,
  },
  {
    path: PermissionActivityPage.path,
    Component: PermissionActivityPage,
  },
];
