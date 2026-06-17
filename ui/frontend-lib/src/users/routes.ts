import { UserPage } from "./pages/User";
import { UserCreatePage } from "./pages/UserCreate";
import { UsersPage } from "./pages/Users";

export const usersRoutes = [
  {
    path: UsersPage.path,
    Component: UsersPage,
    requiredPermission: "api:user",
    permissionAction: "read",
  },
  {
    path: UserPage.path,
    Component: UserPage,
    requiredPermission: "api:user",
    permissionAction: "read",
  },
  {
    path: UserCreatePage.path,
    Component: UserCreatePage,
    requiredPermission: "api:user",
    permissionAction: "write",
  },
];
