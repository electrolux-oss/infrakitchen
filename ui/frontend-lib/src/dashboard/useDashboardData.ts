import { useCallback, useEffect, useRef, useState } from "react";

import { GqlAuditLog } from "../audit_logs/graphql";
import { useConfig } from "../common";
import { notifyError } from "../common/hooks/useNotification";
import { GqlFavorite } from "../favorites/graphql";
import { USER_SHORT_FIELDS } from "../users/graphql";

import {
  ActivityLogEntry,
  DashboardStats,
  FavoriteResource,
  GoldenStateSummary,
} from "./types";

const PAGE_SIZE = 10;

const AUDIT_LOG_FIELDS = `
      id
      action
      model
      entityId
      entityData
      createdAt
      creator {
        ${USER_SHORT_FIELDS}
      }
`;

// Fetches just the next page of audit logs, used by the Recent Activities
// widget's "Load more" button.
const AUDIT_LOGS_QUERY = `
  query AuditLogsPage(
    $auditFilter: JSON
    $auditSort: [String!]
    $auditRange: [Int!]
  ) {
    auditLogs(filter: $auditFilter, sort: $auditSort, range: $auditRange) {
      ${AUDIT_LOG_FIELDS}
    }
  }
`;

const DASHBOARD_QUERY = `
  query Dashboard(
    $auditFilter: JSON
    $auditSort: [String!]
    $auditRange: [Int!]
  ) {
    resourcesCount
    auditLogsCount(filter: $auditFilter)
    favorites {
            componentType
            componentId
            componentData
          }
          auditLogs(filter: $auditFilter, sort: $auditSort, range: $auditRange) {
            ${AUDIT_LOG_FIELDS}
          }
          goldenStateReport {
            overallScore
            projects {
              projectId
              projectName
              score
              total
              compliant
              updateAvailable
              deprecated
              critical
              noGolden
            }
          }
        }
      `;

interface DashboardResponse {
  resourcesCount: number;
  auditLogsCount: number;
  favorites: GqlFavorite[];
  auditLogs: GqlAuditLog[];
  goldenStateReport: GoldenStateSummary | null;
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
    entityName: gql.componentData.entityName,
    template: gql.componentData.template,
  };
}

export const useDashboardData = () => {
  const { ikApi } = useConfig();
  const [favorites, setFavorites] = useState<FavoriteResource[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [activitiesTotal, setActivitiesTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [goldenStateReport, setGoldenStateReport] =
    useState<GoldenStateSummary | null>(null);
  const [hasResources, setHasResources] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    ready: 0,
    needsUpdate: 0,
    critical: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
        setActivitiesTotal(0);
        setGoldenStateReport(null);
        setStats({ total: 0, ready: 0, needsUpdate: 0, critical: 0 });
        return;
      }

      const favoriteDetails = (response?.favorites ?? [])
        .map(transformFavoriteToResource)
        .filter((f): f is FavoriteResource => f !== null);
      setFavorites(favoriteDetails);

      setActivities(
        Array.isArray(response?.auditLogs) ? response.auditLogs : [],
      );
      setActivitiesTotal(response?.auditLogsCount ?? 0);
      const goldenStateReport = response?.goldenStateReport ?? null;
      setGoldenStateReport(goldenStateReport);

      const sumProjects = (key: "compliant" | "updateAvailable" | "critical") =>
        (goldenStateReport?.projects ?? []).reduce(
          (total, project) => total + (project[key] || 0),
          0,
        );

      setStats({
        total: response?.resourcesCount ?? 0,
        ready: sumProjects("compliant"),
        needsUpdate: sumProjects("updateAvailable"),
        critical: sumProjects("critical"),
      });
    } catch (err) {
      notifyError(err);
    } finally {
      if (!initializedRef.current) {
        setLoading(false);
      }
      initializedRef.current = true;
    }
  }, [ikApi]);

  const refetch = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  // Appends the next page of audit logs for the Recent Activities widget.
  const loadMoreActivities = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const current = activities.length;
      const response = await ikApi.graphqlRequest<{ auditLogs: GqlAuditLog[] }>(
        AUDIT_LOGS_QUERY,
        {
          auditFilter: { model: ["resource", "executor"] },
          auditSort: ["created_at", "DESC"],
          auditRange: [current, current + PAGE_SIZE],
        },
      );
      const more = Array.isArray(response?.auditLogs) ? response.auditLogs : [];
      setActivities((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const appended = more.filter((a) => !existingIds.has(a.id));
        return appended.length ? [...prev, ...appended] : prev;
      });
    } catch (err) {
      notifyError(err);
    } finally {
      setLoadingMore(false);
    }
  }, [activities.length, ikApi, loadingMore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  return {
    favorites,
    activities,
    activitiesTotal,
    loadingMore,
    goldenStateReport,
    hasResources,
    stats,
    loading,
    refreshing,
    refetch,
    loadMoreActivities,
  };
};
