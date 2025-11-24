import { RolePage } from "./pages/Role";
import { RoleCreatePage } from "./pages/RoleCreate";
import { RolesPage } from "./pages/Roles";

export const roleRoutes = [
  {
    path: RoleCreatePage.path,
    Component: RoleCreatePage,
  },
  {
    path: RolesPage.path,
    Component: RolesPage,
  },
  {
    path: RolePage.path,
    Component: RolePage,
  },
];
