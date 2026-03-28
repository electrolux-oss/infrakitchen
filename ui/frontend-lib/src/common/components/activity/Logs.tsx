import { useState, useCallback, useEffect } from "react";

import { useEffectOnce } from "react-use";

import { Box, Typography } from "@mui/material";

import { LogEntity, RevisionResponse } from "../../../types";
import { ENTITY_ACTION } from "../../../utils/constants";
import { useConfig } from "../../context";
import { LogView } from "../../LogsComponent/LogView";
import { PlanSummary } from "../../LogsComponent/PlanSummary";
import {
  parsePlanSummary,
  getExecutionStatus,
} from "../../utils/parsePlanSummary";
import type { ExecutionStatus } from "../../utils/parsePlanSummary";

const getSummaryDescription = (eventAction?: string) => {
  switch (eventAction) {
    case ENTITY_ACTION.DRYRUN:
      return "This view shows the dry-run plan. It previews the infrastructure changes before they are applied.";
    case ENTITY_ACTION.DRYRUN_WITH_TEMP_STATE:
      return "This view shows the dry-run plan using the temporary state. It previews the changes without applying them or saving the temporary state.";
    case ENTITY_ACTION.EXECUTE:
      return "This view shows the result of an execution. It summarizes the infrastructure changes that were applied in this run.";
    default:
      return "This view shows a summary of the infrastructure changes for the selected activity run.";
  }
};

export const Logs = (props: {
  entityId: string;
  traceId: string;
  eventAction?: string;
  view: "summary" | "logs" | "revision";
}) => {
  const { entityId, traceId, eventAction, view } = props;
  const { ikApi } = useConfig();
  const logsScrollContainerId = "activityLogsScrollContainer";

  const tabScrollContainerSx = {
    height: "calc(100vh - 300px)",
    minHeight: 400,
    maxHeight: "80vh",
    overflowY: "auto",
    p: 1,
    display: "flex",
    flexDirection: "column",
  };

  const [selectedExecution, setSelectedExecution] = useState<number | null>(
    null,
  );
  const [allLogs, setAllLogs] = useState<LogEntity[]>([]);
  const [status, setStatus] = useState<ExecutionStatus | undefined>(undefined);
  const [hasExecution, setHasExecution] = useState(false);
  const [loaded, setLoaded] = useState(false);
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
    setSelectedExecution(selectedExec);
    setHasExecution(sorted.length > 0);
    setRevisionNumber(sorted.length > 0 ? sorted[0].revision : null);

    if (selectedExec) {
      const allLogsResult = await ikApi.getList("logs", {
        filter: { entity_id: entityId, execution_start: selectedExec },
        pagination: { page: 1, perPage: 10000 },
        sort: { field: "created_at", order: "ASC" },
      });
      setAllLogs(allLogsResult.data || []);
      setStatus(getExecutionStatus(allLogsResult.data || [], eventAction));
    }
    setLoaded(true);
  }, [ikApi, entityId, traceId, eventAction]);

  const fetchRevision = useCallback(() => {
    if (!revisionNumber || revision) return;
    ikApi
      .get(`revisions/${entityId}/${revisionNumber}`)
      .then((response) => setRevision(response))
      .catch((_) => {});
  }, [ikApi, entityId, revisionNumber, revision]);

  useEffectOnce(() => {
    fetchLogsExecutionTime();
  });

  useEffect(() => {
    if (view === "revision" && revisionNumber) {
      fetchRevision();
    }
  }, [view, revisionNumber, fetchRevision]);

  return (
    <Box>
      {view === "summary" && (
        <Box sx={tabScrollContainerSx}>
          {!loaded ? (
            <Typography color="text.secondary">Loading...</Typography>
          ) : !hasExecution ? (
            <Typography color="text.secondary">
              No execution data available.
            </Typography>
          ) : (
            <PlanSummary
              changes={parsePlanSummary(allLogs)}
              status={status}
              description={getSummaryDescription(eventAction)}
            />
          )}
        </Box>
      )}
      {view === "logs" && (
        <Box id={logsScrollContainerId} sx={tabScrollContainerSx}>
          {selectedExecution ? (
            <LogView
              key={selectedExecution}
              entity_id={entityId}
              execution_time={selectedExecution}
              scrollableTarget={logsScrollContainerId}
            />
          ) : (
            <Typography color="text.secondary">No logs available.</Typography>
          )}
        </Box>
      )}
      {view === "revision" && (
        <Box sx={tabScrollContainerSx}>
          {!loaded ? (
            <Typography color="text.secondary">Loading...</Typography>
          ) : revisionNumber === null ? (
            <Typography color="text.secondary">
              No revision available for this run.
            </Typography>
          ) : revision ? (
            <pre style={{ margin: 0 }}>{JSON.stringify(revision, null, 2)}</pre>
          ) : (
            <Typography color="text.secondary">Loading revision...</Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
