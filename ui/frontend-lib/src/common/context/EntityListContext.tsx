import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";

import { GetListParams } from "../../types";
import { notifyError } from "../hooks/useNotification";

import { useConfig } from "./ConfigContext";
import { useEventProvider } from "./EventContext";

interface EntityListContextType {
  entities: any[];
  entity_name: string;
  loading: boolean;
  error?: string | null;
  refreshList: () => void;
}

export const EntityListContext = createContext<
  EntityListContextType | undefined
>(undefined);

export const EntityListProvider = ({
  children,
  entity_name,
  params,
}: {
  children: ReactNode;
  entity_name: string;
  params: GetListParams;
}) => {
  const [entities, setEntities] = useState<Record<string, any>[]>([]);
  const [refresh, refreshNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { ikApi } = useConfig();

  const { event } = useEventProvider();

  useEffect(() => {
    if (event) {
      setEntities((prev) => {
        const idx = prev.findIndex((e) => e.id === event.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = event;
          return updated;
        }
        return prev;
      });
    }
  }, [event]);

  useEffect(() => {
    const getEntities = async () => {
      setLoading(true);
      try {
        const response = await ikApi.getList(`${entity_name}s`, params);
        setEntities(response.data);
        setError(null);
      } catch (e: any) {
        notifyError(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    getEntities();
  }, [ikApi, refresh, entity_name, params]);

  const refreshList = useCallback(() => {
    refreshNumber((prev) => prev + 1);
  }, []);

  const contextValue: EntityListContextType = {
    entities,
    entity_name,
    loading,
    error,
    refreshList,
  };

  return (
    <EntityListContext.Provider value={contextValue}>
      {children}
    </EntityListContext.Provider>
  );
};

export const useEntityListProvider = () => {
  const context = useContext(EntityListContext);
  if (!context) {
    throw new Error("useListProvider must be used within a ListProvider");
  }
  return context;
};
