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

const SNAKE_TO_CAMEL_RE = /_([a-z])/g;

const snakeToCamel = (s: string): string => {
  const camel = s.replace(SNAKE_TO_CAMEL_RE, (_, c: string) => c.toUpperCase());
  return camel.charAt(0).toLowerCase() + camel.slice(1);
};

export const camelizeKeys = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(camelizeKeys);
  }

  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        snakeToCamel(key),
        camelizeKeys(value),
      ]),
    );
  }

  return obj;
};

interface EntityContextType {
  actions: string[];
  entity: any | undefined;
  entity_name: string;
  entity_id: string;
  loading: boolean;
  error?: string | null;
  refreshEntity?: (entity?: IkEntity) => void;
  refreshActions?: () => void;
  userEntityPermissions: string[];
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
  const [userEntityPermissions, setUserEntityPermissions] = useState<string[]>(
    [],
  );
  const [refresh, refreshNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { ikApi } = useConfig();

  const { event } = useEventProvider();

  useEffect(() => {
    if (event && event.id === entity_id) {
      setEntity((prev) => ({ ...prev, ...camelizeKeys(event) }));
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
                userEntityPermissions: userEntityPermissions(entityName: "${entity_name}", entityId: $id)
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
            const userEntityPermissions = response?.userEntityPermissions || [];
            setUserEntityPermissions(userEntityPermissions);
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

  const refreshActions = useCallback(async () => {
    await ikApi
      .graphqlRequest(
        `
        query EntityActions($id: UUID!) {
          ${entity_name}Actions: ${entity_name}Actions(id: $id)
        }
      `,
        { id: entity_id },
      )
      .then((response: any) => {
        const actionsData = response?.[`${entity_name}Actions`] || [];
        setActions(actionsData);
      })
      .catch((e: any) => {
        notifyError(e);
      });
  }, [ikApi, entity_name, entity_id]);

  const contextValue: EntityContextType = {
    actions,
    entity,
    entity_name,
    entity_id,
    loading,
    error,
    refreshEntity,
    refreshActions,
    userEntityPermissions,
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
