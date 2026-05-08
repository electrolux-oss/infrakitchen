import { useCallback, useEffect, useRef, useState } from "react";

import { useConfig } from "../common";
import { notifyError } from "../common/hooks/useNotification";

import { ActivityLogEntry, FavoriteResource } from "./types";

export const useDashboardData = () => {
  const { ikApi } = useConfig();
  const [favorites, setFavorites] = useState<FavoriteResource[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [hasResources, setHasResources] = useState(false);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchData = useCallback(async () => {
    // Only show full loading state on first load; subsequent refreshes update silently
    if (!initializedRef.current) {
      setLoading(true);
    }

    try {
      const resourcesResponse = await ikApi.getList("resources", {
        pagination: { page: 1, perPage: 1 },
        fields: ["id"],
      });
      const resourcesExist =
        (resourcesResponse.total ?? 0) > 0 || resourcesResponse.data.length > 0;

      setHasResources(resourcesExist);

      if (!resourcesExist) {
        setFavorites([]);
        setActivities([]);
        return;
      }

      const favoritesResponse = await ikApi.get("favorites");
      const favoritesList = Array.isArray(favoritesResponse)
        ? favoritesResponse
        : [];

      const favoriteDetails: FavoriteResource[] = [];
      for (const favorite of favoritesList) {
        if (favorite.component_type === "resource") {
          try {
            const resourceDetail = await ikApi.get(
              `resources/${favorite.component_id}`,
            );
            favoriteDetails.push({
              ...resourceDetail,
              _component_type: "resource" as const,
              _component_id: favorite.component_id,
            });
          } catch (err) {
            notifyError(err);
          }
        } else if (favorite.component_type === "executor") {
          try {
            const executorDetail = await ikApi.get(
              `executors/${favorite.component_id}`,
            );
            favoriteDetails.push({
              ...executorDetail,
              _component_type: "executor" as const,
              _component_id: favorite.component_id,
            });
          } catch (err) {
            notifyError(err);
          }
        }
      }

      setFavorites(favoriteDetails);

      try {
        const favoriteEntityIds = favoriteDetails.map((f) => f.id);
        const activityResponse = await ikApi.getList("audit_logs", {
          pagination: { page: 1, perPage: 10 },
          fields: [
            "id",
            "action",
            "creator",
            "model",
            "entity_id",
            "created_at",
          ],
          sort: { field: "created_at", order: "DESC" },
          filter:
            favoriteEntityIds.length > 0
              ? { entity_id: favoriteEntityIds }
              : undefined,
        });

        setActivities(
          Array.isArray(activityResponse?.data) ? activityResponse.data : [],
        );
      } catch (err) {
        notifyError(err);
        setActivities([]);
      }
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
