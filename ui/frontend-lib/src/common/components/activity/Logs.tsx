import { useState, useCallback, useEffect, ReactNode } from "react";

import RefreshIcon from "@mui/icons-material/Refresh";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";

import { LogEntity, RevisionResponse } from "../../../types";
import { useConfig } from "../../context";

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
  const { ikApi } = useConfig();
  const logsScrollContainerId = "activityLogsScrollContainer";

  const [selectedExecution, setSelectedExecution] = useState<number | null>(
    null,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [revisionNumber, setRevisionNumber] = useState<number | null>(null);
  const [revision, setRevision] = useState<RevisionResponse | undefined>(
    undefined,
  );

  const fetchLogsExecutionTime = useCallback(async () => {
    const execution_start_result = await ikApi.get(
      `logs/execution_time/${entityId}`,
      { trace_id: traceId },
    );
    const sorted = execution_start_result.sort(
      (a: LogEntity, b: LogEntity) => b.execution_start - a.execution_start,
    );
    const selectedExec = sorted.length > 0 ? sorted[0].execution_start : null;
    const nextRevisionNumber = sorted.length > 0 ? sorted[0].revision : null;
    setSelectedExecution(selectedExec);
    setRevisionNumber(nextRevisionNumber);
    setRevision(undefined);
  }, [ikApi, entityId, traceId]);

  const fetchRevision = useCallback(() => {
    if (!revisionNumber || revision) return;
    ikApi
      .get(`revisions/${entityId}/${revisionNumber}`)
      .then((response) => setRevision(response))
      .catch((_) => {});
  }, [ikApi, entityId, revisionNumber, revision]);

  useEffect(() => {
    void fetchLogsExecutionTime();
  }, [fetchLogsExecutionTime]);

  useEffect(() => {
    if (view === "revision" && revisionNumber) {
      fetchRevision();
    }
  }, [view, revisionNumber, fetchRevision]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchLogsExecutionTime();
      setRefreshKey((prev) => prev + 1);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchLogsExecutionTime]);

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
          {selectedExecution ? (
            <SummaryView
              entityId={entityId}
              traceId={traceId}
              eventAction={eventAction}
              refreshKey={refreshKey}
              onOpenLogs={onOpenLogs}
            />
          ) : (
            <Typography color="text.secondary">No data available.</Typography>
          )}
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
          {selectedExecution ? (
            <LogsView
              entityId={entityId}
              executionTime={selectedExecution}
              scrollContainerId={logsScrollContainerId}
            />
          ) : (
            <Typography color="text.secondary">No logs available.</Typography>
          )}
        </>
      )}
      {view === "revision" && (
        <Box
          sx={{
            height: "calc(100vh - 300px)",
            minHeight: 400,
            maxHeight: "80vh",
            overflowY: "auto",
            p: 1,
          }}
        >
          {revisionNumber === null ? (
            <Typography color="text.secondary">
              No revision available for this run.
            </Typography>
          ) : revision ? (
            <pre style={{ margin: 0, fontSize: "0.8rem" }}>
              {JSON.stringify(revision, null, 2)}
            </pre>
          ) : (
            <Typography color="text.secondary">Loading revision...</Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
