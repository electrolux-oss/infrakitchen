import { RolePage } from "./pages/Role";
import { RoleCreatePage } from "./pages/RoleCreate";
import { RolesPage } from "./pages/Roles";

export const roleRoutes = [
  {
    path: RoleCreatePage.path,
    Component: RoleCreatePage,
    requiredPermission: "api:permission",
    permissionAction: "write",
  },
  {
    path: RolesPage.path,
    Component: RolesPage,
    requiredPermission: "api:permission",
    permissionAction: "read",
  },
  {
    path: RolePage.path,
    Component: RolePage,
    requiredPermission: "api:permission",
    permissionAction: "read",
  },
];
