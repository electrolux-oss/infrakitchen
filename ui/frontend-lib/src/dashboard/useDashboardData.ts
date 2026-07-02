import { useCallback, useEffect, useRef, useState } from "react";

import { GqlAuditLog } from "../audit_logs/graphql";
import { useConfig } from "../common";
import { notifyError } from "../common/hooks/useNotification";
import { GqlFavorite } from "../favorites/graphql";
import { USER_SHORT_FIELDS } from "../users/graphql";

import { ActivityLogEntry, FavoriteResource } from "./types";

const DASHBOARD_QUERY = `
  query Dashboard($auditFilter: JSON, $auditSort: [String!], $auditRange: [Int!]) {
    resourcesCount
    favorites {
      componentType
      componentId
      componentData
    }
    auditLogs(filter: $auditFilter, sort: $auditSort, range: $auditRange) {
      id
      action
      model
      entityId
      entityData
      createdAt
      creator {
        ${USER_SHORT_FIELDS}
      }
    }
  }
`;

interface DashboardResponse {
  resourcesCount: number;
  favorites: GqlFavorite[];
  auditLogs: GqlAuditLog[];
}

function transformFavoriteToResource(
  gql: GqlFavorite,
): FavoriteResource | null {
  if (!gql.componentData) return null;
  return {
    id: gql.componentData.id,
    name: gql.componentData.name ?? "",
    status: gql.componentData.status ?? "",
    state: gql.componentData.state ?? "",
    updatedAt: gql.componentData.updatedAt,
    _component_type: gql.componentType as "resource" | "executor",
    _component_id: gql.componentId,
    _entity_name: gql.componentData._entity_name,
  };
}

export const useDashboardData = () => {
  const { ikApi } = useConfig();
  const [favorites, setFavorites] = useState<FavoriteResource[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [hasResources, setHasResources] = useState(false);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!initializedRef.current) {
      setLoading(true);
    }

    try {
      const response = await ikApi.graphqlRequest<DashboardResponse>(
        DASHBOARD_QUERY,
        {
          auditFilter: { model: ["resource", "executor"] },
          auditSort: ["created_at", "DESC"],
          auditRange: [0, 10],
        },
      );

      const resourcesExist = (response?.resourcesCount ?? 0) > 0;
      setHasResources(resourcesExist);

      if (!resourcesExist) {
        setFavorites([]);
        setActivities([]);
        return;
      }

      const favoriteDetails = (response?.favorites ?? [])
        .map(transformFavoriteToResource)
        .filter((f): f is FavoriteResource => f !== null);
      setFavorites(favoriteDetails);

      setActivities(
        Array.isArray(response?.auditLogs) ? response.auditLogs : [],
      );
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
      initializedRef.current = true;
    }
  }, [ikApi]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    favorites,
    activities,
    hasResources,
    loading,
    refetch: fetchData,
  };
};
