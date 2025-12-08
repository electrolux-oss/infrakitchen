import { ReactNode } from "react";

import { usePermissionProvider } from "../context";

interface PermissionWrapperProps {
  children: ReactNode;
  requiredPermission?: string;
  permissionAction?: "read" | "write" | "admin";
}

export const PermissionWrapper = (props: PermissionWrapperProps) => {
  const { children, requiredPermission, permissionAction } = props;
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
  if (requiredPermission && permissionAction) {
    const hasPermission = checkActionPermission(
      requiredPermission,
      permissionAction,
    );
    if (!hasPermission) {
      return null;
    }
  }
  return <>{children}</>;
};
