import { UserPage } from "./pages/User";
import { UserActivityPage } from "./pages/UserActivity";
import { UserCreatePage } from "./pages/UserCreate";
import { UserEditPage } from "./pages/UserEdit";
import { UsersPage } from "./pages/Users";

export const usersRoutes = [
  {
    path: UsersPage.path,
    Component: UsersPage,
  },
  {
    path: UserPage.path,
    Component: UserPage,
  },
  {
    path: UserActivityPage.path,
    Component: UserActivityPage,
  },
  {
    path: UserCreatePage.path,
    Component: UserCreatePage,
  },
  {
    path: UserEditPage.path,
    Component: UserEditPage,
  },
];
