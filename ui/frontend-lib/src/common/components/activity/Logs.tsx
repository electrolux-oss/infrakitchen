import { SyntheticEvent, useState, useCallback } from "react";

import { useEffectOnce } from "react-use";

import { Box, Tab, Tabs } from "@mui/material";

import { LogEntity, RevisionResponse } from "../../../types";
import { useConfig } from "../../context";
import { LogView } from "../../LogsComponent/LogView";

export const Logs = (props: { entityId: string; traceId: string }) => {
  const { entityId, traceId } = props;
  const { ikApi } = useConfig();

  const [selectedExecution, setSelectedExecution] = useState<number | null>(
    null,
  );
  const [, setExecutionList] = useState<LogEntity[]>([]);
  const [revisionNumber, setRevisionNumber] = useState<number | null>(null);
  const [revision, setRevision] = useState<RevisionResponse | undefined>(
    undefined,
  );
  const [activeTab, setActiveTab] = useState(0);

  const fetchLogsExecutionTime = useCallback(async () => {
    const execution_start_result = await ikApi.get(
      `logs/execution_time/${entityId}`,
      { trace_id: traceId },
    );
    setExecutionList(
      execution_start_result.sort((a: LogEntity, b: LogEntity) => {
        return b.execution_start - a.execution_start;
      }),
    );
    setSelectedExecution(
      execution_start_result.length > 0
        ? execution_start_result[0].execution_start
        : null,
    );
    setRevisionNumber(
      execution_start_result.length > 0
        ? execution_start_result[0].revision || null
        : null,
    );
  }, [ikApi, entityId, traceId]);

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

  const handleTabChange = (_: SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    if (newValue === 1) fetchRevision();
  };

  return (
    <Box>
      {revisionNumber && (
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="Logs" />
          <Tab label="Revision" />
        </Tabs>
      )}
      {activeTab === 0 && (
        <>
          {selectedExecution ? (
            <LogView
              key={selectedExecution}
              entity_id={entityId}
              execution_time={selectedExecution}
            />
          ) : (
            <Box>No logs available.</Box>
          )}
        </>
      )}
      {activeTab === 1 && (
        <Box>
          {revision ? (
            <pre style={{ margin: 0 }}>{JSON.stringify(revision, null, 2)}</pre>
          ) : (
            "Loading..."
          )}
        </Box>
      )}
    </Box>
  );
};
