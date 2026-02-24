import { RouteObject } from "react-router";

import { administrationRoutes } from "./administration";
import { auditLogsRoutes } from "./audit_logs";
import { authProviderRoutes } from "./auth_providers";
import { batchOperationRoutes } from "./batch_operations";
import { usePermissionProvider } from "./common";
import { executorRoutes } from "./executors";
import { GettingStartedPage, NotFoundPage } from "./getting_started";
import { integrationRoutes } from "./integrations";
import { permissionRoutes } from "./permissions";
import { resourceRoutes } from "./resources";
import { roleRoutes } from "./roles";
import { secretRoutes } from "./secrets";
import { sourceCodeRoutes } from "./source_codes";
import { storageRoutes } from "./storages";
import { taskRoutes } from "./tasks";
import { templateRoutes } from "./templates";
import { usersRoutes } from "./users";
import { workerRoutes } from "./workers";
import { workspaceRoutes } from "./workspaces";

type RouteGroup = {
  key: string;
  routes: RouteObject[];
};

type PermissibleRoute = RouteObject & {
  requiredPermission?: string;
  permissionAction?: string;
};

const routeGroups: RouteGroup[] = [
  { key: "administration", routes: administrationRoutes },
  { key: "auditLogs", routes: auditLogsRoutes },
  { key: "users", routes: usersRoutes },
  { key: "role", routes: roleRoutes },
  { key: "permission", routes: permissionRoutes },
  { key: "authProvider", routes: authProviderRoutes },
  { key: "template", routes: templateRoutes },
  { key: "integration", routes: integrationRoutes },
  { key: "resource", routes: resourceRoutes },
  { key: "batchOperation", routes: batchOperationRoutes },
  { key: "storage", routes: storageRoutes },
  { key: "secret", routes: secretRoutes },
  { key: "sourceCode", routes: sourceCodeRoutes },
  { key: "task", routes: taskRoutes },
  { key: "workspace", routes: workspaceRoutes },
  { key: "worker", routes: workerRoutes },
  { key: "executor", routes: executorRoutes },
];

export const useFilteredProtectedRoutes = (): RouteObject[] => {
  const { permissions } = usePermissionProvider();

  const checkActionPermission = (resource: string, action: string): boolean => {
    if (permissions["*"] === "admin") {
      return true;
    }

    const userPermission = permissions[resource];

    if (!userPermission) {
      return false;
    }

    if (action === "read") {
      return true;
    }

    if (action === "write") {
      return userPermission === "write" || userPermission === "admin";
    }

    if (action === "admin") {
      return userPermission === "admin";
    }

    return false;
  };

  const accessibleRoutes = routeGroups.flatMap((group) => {
    if (group.routes.length > 0) {
      return group.routes.filter((route) => {
        const pRoute = route as PermissibleRoute;

        if (pRoute.requiredPermission && pRoute.permissionAction) {
          return checkActionPermission(
            pRoute.requiredPermission,
            pRoute.permissionAction,
          );
        }

        return false;
      });
    }

    return [];
  });

  accessibleRoutes.push(
    { path: "/", Component: GettingStartedPage },
    { path: GettingStartedPage.path, Component: GettingStartedPage },
    { path: "*", Component: NotFoundPage },
  );

  return accessibleRoutes;
};
