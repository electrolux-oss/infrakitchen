import { UserPage } from "./pages/User";
import { UserActivityPage } from "./pages/UserActivity";
import { UserCreatePage } from "./pages/UserCreate";
import { UserEditPage } from "./pages/UserEdit";
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
    path: UserActivityPage.path,
    Component: UserActivityPage,
    requiredPermission: "api:user",
    permissionAction: "read",
  },
  {
    path: UserCreatePage.path,
    Component: UserCreatePage,
    requiredPermission: "api:user",
    permissionAction: "write",
  },
  {
    path: UserEditPage.path,
    Component: UserEditPage,
    requiredPermission: "api:user",
    permissionAction: "write",
  },
];
