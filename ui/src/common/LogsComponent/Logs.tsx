import { useState, useCallback, useEffect, ReactNode } from "react";

import { HeroArrowPathIcon } from "../../icons";
import { IconButton, Tooltip } from "../../ui";

import { LogsView } from "./LogsView";
import { SummaryView } from "./SummaryView";

const getSummaryDescription = (eventAction?: string) => {
  switch (eventAction) {
    case "dryrun":
    case "dryrun_with_temp_state":
      return "Preview the infrastructure changes before applying them.";
    case "execute":
      return "Here's what changed in your infrastructure from this run.";
    default:
      return "Summary of infrastructure changes for this activity.";
  }
};

export const Logs = (props: {
  entityId: string;
  auditLogId?: string;
  traceId?: string;
  executionStart?: number;
  eventAction?: string;
  view: "summary" | "logs" | "revision";
  onHeaderActionReady?: (headerAction: ReactNode) => void;
  onOpenLogs?: () => void;
}) => {
  const {
    entityId,
    auditLogId,
    traceId,
    executionStart,
    eventAction,
    view,
    onHeaderActionReady,
    onOpenLogs,
  } = props;
  const logsScrollContainerId = "activityLogsScrollContainer";

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(1);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setRefreshKey((prev) => prev + 1);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const refreshAction = (
      <Tooltip title={isRefreshing ? "Refreshing..." : "Refresh"}>
        <span>
          <IconButton
            size="small"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            aria-label="Refresh"
          >
            <HeroArrowPathIcon />
          </IconButton>
        </span>
      </Tooltip>
    );

    if (view === "summary" || view === "logs") {
      if (onHeaderActionReady) {
        onHeaderActionReady(refreshAction);
      }
    }
  }, [isRefreshing, view, onHeaderActionReady, handleManualRefresh]);

  return (
    <div>
      {view === "summary" && (
        <>
          <div className="mb-4 flex justify-start gap-2 px-1">
            <p className="m-0 text-body2">
              {getSummaryDescription(eventAction)}
            </p>
          </div>
          <SummaryView
            entityId={entityId}
            auditLogId={auditLogId}
            traceId={traceId}
            executionStart={executionStart}
            eventAction={eventAction}
            refreshKey={refreshKey}
            onOpenLogs={onOpenLogs}
          />
        </>
      )}
      {view === "logs" && (
        <>
          <div className="mb-4 flex justify-start gap-2 px-1"></div>
          <LogsView
            key={refreshKey}
            entityId={entityId}
            auditLogId={auditLogId}
            traceId={traceId}
            executionTime={executionStart}
            scrollContainerId={logsScrollContainerId}
          />
        </>
      )}
    </div>
  );
};
