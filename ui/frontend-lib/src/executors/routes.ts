import { ExecutorPage } from "./pages/Executor";
import { ExecutorCreatePage } from "./pages/ExecutorCreate";
import { ExecutorEditPage } from "./pages/ExecutorEdit";
import { ExecutorsPage } from "./pages/Executors";

export const executorRoutes = [
  {
    path: ExecutorsPage.path,
    Component: ExecutorsPage,
    requiredPermission: "api:executor",
    permissionAction: "read",
  },
  {
    path: ExecutorPage.path,
    Component: ExecutorPage,
    requiredPermission: "api:executor",
    permissionAction: "read",
  },
  {
    path: ExecutorCreatePage.path,
    Component: ExecutorCreatePage,
    requiredPermission: "api:executor",
    permissionAction: "read",
  },
  {
    path: ExecutorEditPage.path,
    Component: ExecutorEditPage,
    requiredPermission: "api:executor",
    permissionAction: "read",
  },
];
