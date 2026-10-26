import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";

import { ApiClientError, isNotFoundError } from "../../errors";
import {
  GqlResourceTempState,
  GqlScheduledResourceAction,
} from "../../resources/graphql";
import { IkEntity } from "../../types";
import { notifyError } from "../hooks/useNotification";

import { useConfig } from "./ConfigContext";
import { useEventProvider } from "./EventContext";

const SNAKE_TO_CAMEL_RE = /_([a-z])/g;

const snakeToCamel = (s: string): string => {
  const camel = s.replace(SNAKE_TO_CAMEL_RE, (_, c: string) => c.toUpperCase());
  return camel.charAt(0).toLowerCase() + camel.slice(1);
};

// Fields holding user data (GraphQL JSON scalars): their contents keep the
// original keys, e.g. Terraform variable values or tags.
const RAW_JSON_FIELDS = new Set([
  "value",
  "default",
  "configuration",
  "dependency_tags",
  "dependency_config",
  "dependency_config_overrides",
  "default_variables",
  "resolved_variables",
  "resolved_dependency_config",
  "variable_overrides",
  "source_code_version_overrides",
  "parent_overrides",
  "wiring",
  "payload",
  "host_metadata",
]);

export const camelizeKeys = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(camelizeKeys);
  }

  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        snakeToCamel(key),
        RAW_JSON_FIELDS.has(key) ? value : camelizeKeys(value),
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
  refreshVersion: number;
  /** When the query that loaded `entity` was sent (ms); events after it are newer. */
  fetchedAt: number;
  loading: boolean;
  error?: string | null;
  notFound: boolean;
  refreshEntity?: (entity?: IkEntity) => void;
  refreshActions?: () => void;
  userEntityPermissions: string[];
  resourceTempState: GqlResourceTempState | null;
  scheduledActions: GqlScheduledResourceAction[];
  pendingChanges: Record<string, any> | null;
  hasPendingChange: (key: string) => boolean;
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
  refetchOnEvent = false,
}: {
  children: ReactNode;
  entity_name: string;
  entity_id: string;
  entityFields?: string;
  transformFn?: (data: any) => any;
  /**
   * Refetch the entity on each of its events instead of merging the event body,
   * for entities whose nested data events can't be merged into (e.g. workflow steps).
   */
  refetchOnEvent?: boolean;
}) => {
  const [actions, setActions] = useState<string[]>([]);
  const [entity, setEntity] = useState<Record<string, any>>();
  const [userEntityPermissions, setUserEntityPermissions] = useState<string[]>(
    [],
  );
  const [refresh, refreshNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);
  const { ikApi } = useConfig();

  const [fetchedAt, setFetchedAt] = useState<number>(0);
  const { event, resyncVersion } = useEventProvider();

  // The entity's task queue section follows queue events on its own (TaskQueueProvider)
  const [silentRefresh, setSilentRefresh] = useState<number>(0);

  // Events may have been lost, so the merged entity may be behind
  const handledResyncRef = useRef(resyncVersion);
  useEffect(() => {
    if (resyncVersion === handledResyncRef.current) return;
    handledResyncRef.current = resyncVersion;
    setSilentRefresh((prev) => prev + 1);
  }, [resyncVersion]);

  useEffect(() => {
    if (event && event.id === entity_id) {
      if (refetchOnEvent) {
        setSilentRefresh((prev) => prev + 1);
        return;
      }
      // Events too big for the live stream keep only small top-level fields,
      // the rest has to be refetched
      const truncated = !!event._metadata?.truncated;
      setEntity((prev) => ({ ...prev, ...camelizeKeys(event) }));
      if (truncated) {
        setSilentRefresh((prev) => prev + 1);
      }
    }
  }, [event, entity_id, refetchOnEvent]);

  // Events can trigger refetches in quick succession; only the latest response is applied
  const latestFetchRef = useRef(0);

  const fetchEntity = useCallback(
    async (silent: boolean) => {
      if (!entity_id) return;
      if (!silent) setLoading(true);
      const fetchId = ++latestFetchRef.current;
      const isStale = () => fetchId !== latestFetchRef.current;
      const startedAt = Date.now();
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
            if (isStale()) return undefined;
            const data = response?.[entity_name];
            if (!data) {
              throw new ApiClientError(
                404,
                `${entity_name} not found`,
                "NOT_FOUND",
                {},
              );
            }
            const actionsData = response?.[`${entity_name}Actions`] || [];
            const userEntityPermissions = response?.userEntityPermissions || [];
            setUserEntityPermissions(userEntityPermissions);
            setActions(actionsData);
            return transformFn ? transformFn(data) : data;
          })
          .then((response: any) => {
            if (isStale()) return;
            setEntity(response);
            setFetchedAt(startedAt);
            setNotFound(false);
            setError(null);
          });
      } catch (e: any) {
        // A failed background refresh keeps the page as it is
        if (silent || isStale()) return;
        const entityNotFound = isNotFoundError(e);
        if (!entityNotFound) {
          notifyError(e);
        }
        setNotFound(entityNotFound);
        setError(e.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [ikApi, entity_name, entity_id, entityFields, transformFn],
  );

  useEffect(() => {
    fetchEntity(false);
  }, [fetchEntity, refresh]);

  useEffect(() => {
    if (silentRefresh > 0) {
      fetchEntity(true);
    }
  }, [fetchEntity, silentRefresh]);

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

  const resourceTempState = useMemo(
    () => (entity_name === "resource" ? (entity?.tempState ?? null) : null),
    [entity, entity_name],
  );

  const pendingChanges = useMemo(
    () => resourceTempState?.value ?? null,
    [resourceTempState],
  );

  const scheduledActions = useMemo(
    () =>
      entity_name === "resource" || entity_name === "executor"
        ? ((entity?.scheduledActions as GqlScheduledResourceAction[] | null) ??
          [])
        : [],
    [entity, entity_name],
  );

  const hasPendingChange = useCallback(
    (key: string) =>
      pendingChanges !== null &&
      Object.prototype.hasOwnProperty.call(pendingChanges, key),
    [pendingChanges],
  );

  const contextValue: EntityContextType = {
    actions,
    entity,
    entity_name,
    entity_id,
    refreshVersion: refresh,
    fetchedAt,
    loading,
    error,
    notFound,
    refreshEntity,
    refreshActions,
    userEntityPermissions,
    resourceTempState,
    scheduledActions,
    pendingChanges,
    hasPendingChange,
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
