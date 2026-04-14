import { useState, useCallback, useEffect, ReactNode } from "react";

import RefreshIcon from "@mui/icons-material/Refresh";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";

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
  traceId: string;
  eventAction?: string;
  view: "summary" | "logs" | "revision";
  onHeaderActionReady?: (headerAction: ReactNode) => void;
  onOpenLogs?: () => void;
}) => {
  const {
    entityId,
    traceId,
    eventAction,
    view,
    onHeaderActionReady,
    onOpenLogs,
  } = props;
  const logsScrollContainerId = "activityLogsScrollContainer";

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
            <RefreshIcon />
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
    <Box>
      {view === "summary" && (
        <>
          <Box
            sx={{
              px: 0.5,
              mb: 2,
              display: "flex",
              justifyContent: "flex-start",
              gap: 1,
            }}
          >
            <Typography variant="body2">
              {getSummaryDescription(eventAction)}
            </Typography>
          </Box>
          <SummaryView
            entityId={entityId}
            traceId={traceId}
            eventAction={eventAction}
            refreshKey={refreshKey}
            onOpenLogs={onOpenLogs}
          />
        </>
      )}
      {view === "logs" && (
        <>
          <Box
            sx={{
              px: 0.5,
              mb: 2,
              display: "flex",
              justifyContent: "flex-start",
              gap: 1,
            }}
          ></Box>
          <LogsView
            entityId={entityId}
            auditLogId={traceId}
            scrollContainerId={logsScrollContainerId}
          />
        </>
      )}
    </Box>
  );
};
