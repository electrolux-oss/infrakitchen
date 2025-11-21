import { RolePage } from "./pages/Role";
import { RolesPage } from "./pages/Roles";
import { RoleCreatePage } from "./pages/RoleCreate";

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
