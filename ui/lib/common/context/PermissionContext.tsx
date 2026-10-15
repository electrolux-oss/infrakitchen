import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";

import { notifyError } from "../hooks/useNotification";

import { useConfig } from "./ConfigContext";

interface PermissionContextType {
  permissions: Record<string, string>;
  loading: boolean;
  error?: string | null;
  refreshPermission?: () => void;
  checkActionPermission: (resource: string, action: string) => boolean;
}

export const PermissionContext = createContext<
  PermissionContextType | undefined
>(undefined);

export const PermissionProvider = ({ children }: { children: ReactNode }) => {
  const { ikApi, bootstrapPermissions, bootstrapLoading, bootstrapError } =
    useConfig();
  const [permissions, setPermission] = useState<Record<string, string>>(
    bootstrapPermissions || {},
  );
  const [refresh, refreshPermission] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(!!bootstrapLoading);
  const [error, setError] = useState<string | null>(bootstrapError || null);

  useEffect(() => {
    setPermission(bootstrapPermissions || {});
    setLoading(!!bootstrapLoading);
    setError(bootstrapError || null);
  }, [bootstrapPermissions, bootstrapLoading, bootstrapError]);

  useEffect(() => {
    if (refresh === 0) {
      return;
    }

    const getPermission = async () => {
      setLoading(true);
      try {
        const response = await ikApi.graphqlRequest<{
          userApiPolicies: Record<string, string>;
        }>("{ userApiPolicies }");
        setPermission(response.userApiPolicies);
        setError(null);
      } catch (e: any) {
        notifyError(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    getPermission();
  }, [ikApi, refresh]);

  const checkActionPermission = useCallback(
    (resource: string, action: string): boolean => {
      const currentPermissions = permissions || {};
      if (currentPermissions["*"] === "admin") {
        return true;
      }

      const userPermission = currentPermissions[resource];

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
    },
    [permissions],
  );

  const contextValue: PermissionContextType = {
    permissions: permissions || {},
    loading,
    error,
    refreshPermission: () => refreshPermission((prev) => prev + 1),
    checkActionPermission,
  };
  return (
    <PermissionContext.Provider value={contextValue}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissionProvider = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error(
      "usePermissionProvider must be used within a PermissionProvider",
    );
  }
  return context;
};
