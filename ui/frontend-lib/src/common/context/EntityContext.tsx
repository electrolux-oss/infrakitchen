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
import { useEventProvider } from "./EventContext";

interface EntityContextType {
  actions: string[];
  entity: any | undefined;
  entity_name: string;
  entity_id: string;
  loading: boolean;
  error?: string | null;
  refreshEntity?: () => void;
}

export const EntityContext = createContext<EntityContextType | undefined>(
  undefined,
);

export const EntityProvider = ({
  children,
  entity_name,
  entity_id,
}: {
  children: ReactNode;
  entity_name: string;
  entity_id: string;
}) => {
  const [actions, setActions] = useState<string[]>([]);
  const [entity, setEntity] = useState<Record<string, any>>();
  const [refresh, refreshEntity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { ikApi } = useConfig();

  const { event } = useEventProvider();

  const userActionsHandler = useCallback(async (): Promise<any> => {
    ikApi
      .get(`${entity_name}s/${entity_id}/actions`)
      .then((response: any) => {
        setActions(response);
      })
      .catch((error: any) => {
        notifyError(error);
      });
  }, [ikApi, entity_name, entity_id, setActions]);

  useEffect(() => {
    userActionsHandler();
  }, [userActionsHandler]);

  useEffect(() => {
    if (event && event.id === entity_id) {
      setEntity(event);
      userActionsHandler();
    }
  }, [event, entity_id, userActionsHandler]);

  useEffect(() => {
    const getEntity = async () => {
      if (!entity_id) return;
      setLoading(true);
      try {
        const response = await ikApi.get(`${entity_name}s/${entity_id}`);
        setEntity(response);
        setError(null);
      } catch (e: any) {
        notifyError(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    getEntity();
  }, [ikApi, entity_name, entity_id, refresh, setLoading, setError]);

  const contextValue: EntityContextType = {
    actions,
    entity,
    entity_name,
    entity_id,
    loading,
    error,
    refreshEntity: () => refreshEntity((prev) => prev + 1),
  };
  return (
    <EntityContext.Provider value={contextValue}>
      {children}
    </EntityContext.Provider>
  );
};

export const useEntityProvider = () => {
  const context = useContext(EntityContext);
  if (!context) {
    throw new Error("useEntityProvider must be used within a EntityProvider");
  }
  return context;
};
