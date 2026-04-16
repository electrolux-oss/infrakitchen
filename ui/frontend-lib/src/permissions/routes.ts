import { PermissionPage } from "./pages/Permission";

export const permissionRoutes = [
  {
    path: PermissionPage.path,
    Component: PermissionPage,
    requiredPermission: "api:permission",
    permissionAction: "read",
  },
];
