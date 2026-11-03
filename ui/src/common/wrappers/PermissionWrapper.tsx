import { ReactNode } from "react";

import { usePermissionProvider } from "../context";

type PermissionAction = "read" | "write" | "admin";

interface PermissionWrapperProps {
  children: ReactNode;
  requiredPermission?: string;
  permissionAction?: PermissionAction;
}

/** Whether the current user may perform `action` on `resource`. */
export const useHasPermission = (
  resource: string,
  action: PermissionAction,
): boolean => {
  const { permissions } = usePermissionProvider();
  if (permissions["*"] === "admin") return true;

  const userPermission = permissions[resource];
  if (!userPermission) return false;

  switch (action) {
    case "read":
      return true;
    case "write":
      return userPermission === "write" || userPermission === "admin";
    case "admin":
      return userPermission === "admin";
    default:
      return false;
  }
};

export const PermissionWrapper = (props: PermissionWrapperProps) => {
  const { children, requiredPermission, permissionAction } = props;
  const allowed = useHasPermission(
    requiredPermission ?? "",
    permissionAction ?? "read",
  );
  if (requiredPermission && permissionAction && !allowed) {
    return null;
  }
  return <>{children}</>;
};
