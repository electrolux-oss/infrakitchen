import { RouteObject } from "react-router";

import {
  usePermissionProvider,
  GettingStartedPage,
  administrationRoutes,
  auditLogsRoutes,
  authProviderRoutes,
  templateRoutes,
  integrationRoutes,
  resourceRoutes,
  storageRoutes,
  sourceCodeRoutes,
  sourceCodeVersionRoutes,
  taskRoutes,
  workspaceRoutes,
  workerRoutes,
  usersRoutes,
  roleRoutes,
  permissionRoutes,
  secretRoutes,
} from "@electrolux-oss/infrakitchen";

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
  { key: "storage", routes: storageRoutes },
  { key: "secret", routes: secretRoutes },
  { key: "sourceCode", routes: sourceCodeRoutes },
  { key: "sourceCodeVersion", routes: sourceCodeVersionRoutes },
  { key: "task", routes: taskRoutes },
  { key: "workspace", routes: workspaceRoutes },
  { key: "worker", routes: workerRoutes },
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
    { path: GettingStartedPage.path, Component: GettingStartedPage },
    { path: "*", Component: GettingStartedPage },
  );

  return accessibleRoutes;
};
