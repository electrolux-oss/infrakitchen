import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";

import { IkEntity } from "../../types";
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
  refreshEntity?: (entity?: IkEntity) => void;
}

export const EntityContext = createContext<EntityContextType | undefined>(
  undefined,
);

export const EntityProvider = ({
  children,
  entity_name,
  entity_id,
  entityFields,
  transformFn,
}: {
  children: ReactNode;
  entity_name: string;
  entity_id: string;
  entityFields?: string;
  transformFn?: (data: any) => any;
}) => {
  const [actions, setActions] = useState<string[]>([]);
  const [entity, setEntity] = useState<Record<string, any>>();
  const [refresh, refreshNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { ikApi } = useConfig();

  const { event } = useEventProvider();

  useEffect(() => {
    if (event && event.id === entity_id) {
      setEntity(event);
    }
  }, [event, entity_id]);

  useEffect(() => {
    const getEntity = async () => {
      if (!entity_id) return;
      setLoading(true);
      try {
        await ikApi
          .graphqlRequest(
            `
              query Entity($id: UUID!) {
                ${entity_name}(id: $id) {
                  ${entityFields}
                }
                ${entity_name}Actions: ${entity_name}Actions(id: $id)
              }
            `,
            { id: entity_id },
          )
          .then((response: any) => {
            const data = response?.[entity_name];
            if (!data) {
              throw new Error(`${entity_name} not found`);
            }
            const actionsData = response?.[`${entity_name}Actions`] || [];
            setActions(actionsData);
            return transformFn ? transformFn(data) : data;
          })
          .then((response: any) => {
            setEntity(response);
            setError(null);
            // userActionsHandler();
          });
      } catch (e: any) {
        notifyError(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    getEntity();
  }, [
    ikApi,
    entity_name,
    entity_id,
    refresh,
    entityFields,
    transformFn,
    setLoading,
    setError,
  ]);

  const refreshEntity = useCallback((updatedEntity?: IkEntity) => {
    if (updatedEntity) {
      setEntity(updatedEntity);
    } else {
      refreshNumber((prev) => prev + 1);
    }
  }, []);

  const contextValue: EntityContextType = {
    actions,
    entity,
    entity_name,
    entity_id,
    loading,
    error,
    refreshEntity,
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
