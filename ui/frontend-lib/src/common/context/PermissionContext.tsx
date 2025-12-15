import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

import { notifyError } from "../hooks/useNotification";

import { useConfig } from "./ConfigContext";

interface PermissionContextType {
  permissions: Record<string, string>;
  loading: boolean;
  error?: string | null;
  refreshPermission?: () => void;
}

export const PermissionContext = createContext<
  PermissionContextType | undefined
>(undefined);

export const PermissionProvider = ({ children }: { children: ReactNode }) => {
  const [permissions, setPermission] = useState<Record<string, string>>();
  const [refresh, refreshPermission] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { ikApi } = useConfig();

  useEffect(() => {
    const getPermission = async () => {
      setLoading(true);
      try {
        const response = await ikApi.get("user/policies");
        setPermission(response);
        setError(null);
      } catch (e: any) {
        notifyError(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    getPermission();
  }, [ikApi, refresh, setLoading, setError]);

  const contextValue: PermissionContextType = {
    permissions: permissions || {},
    loading,
    error,
    refreshPermission: () => refreshPermission((prev) => prev + 1),
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
