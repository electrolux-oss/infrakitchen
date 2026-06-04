import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";

import { GetListParams } from "../../types";
import {
  buildGraphqlFields,
  GraphqlFieldMap,
} from "../graphql/buildGraphqlFields";
import { notifyError } from "../hooks/useNotification";

import { useConfig } from "./ConfigContext";
import { useEventProvider } from "./EventContext";

interface EntityListContextType {
  entities: any[];
  entity_name: string;
  loading: boolean;
  total: number;
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
  entityFieldMap,
  transformFn,
}: {
  children: ReactNode;
  entity_name: string;
  params: GetListParams;
  entityFieldMap?: GraphqlFieldMap;
  transformFn?: (data: any) => any;
}) => {
  const [entities, setEntities] = useState<Record<string, any>[]>([]);
  const [total, setTotal] = useState<number>(0);
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
      const gqlParams = {
        filter: params.filter,
        sort: params.sort ? [params.sort.field, params.sort.order] : undefined,
        range: params.pagination
          ? [
              (params.pagination.page - 1) * params.pagination.perPage,
              params.pagination.page * params.pagination.perPage,
            ]
          : undefined,
      };
      try {
        await ikApi
          .graphqlRequest(
            `query Query($filter: JSON, $sort: [String!], $range: [Int!]) {
          ${entity_name}s(filter: $filter, sort: $sort, range: $range) {
            ${buildGraphqlFields(params.fields ?? [], entityFieldMap || {})}
          }
          ${entity_name}sCount(filter: $filter)
        }`,
            gqlParams,
          )
          .then((response: any) => {
            const data = response?.[`${entity_name}s`] || [];
            const total = response?.[`${entity_name}sCount`] || 0;
            setTotal(total);
            setEntities(transformFn ? data.map(transformFn) : data);
            setError(null);
          });
      } catch (e: any) {
        notifyError(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    getEntities();
  }, [ikApi, refresh, entity_name, params, entityFieldMap, transformFn]);

  const refreshList = useCallback(() => {
    refreshNumber((prev) => prev + 1);
  }, []);

  const contextValue: EntityListContextType = {
    entities,
    entity_name,
    loading,
    total,
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
