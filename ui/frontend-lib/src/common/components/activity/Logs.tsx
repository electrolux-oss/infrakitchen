import { useState, useCallback } from "react";

import { useEffectOnce } from "react-use";

import { Box } from "@mui/material";

import { LogEntity } from "../../../types";
import { useConfig } from "../../context";
import { LogView } from "../../LogsComponent/LogView";

export const Logs = (props: { entityId: string; traceId: string }) => {
  const { entityId, traceId } = props;
  const { ikApi } = useConfig();

  const [selectedExecution, setSelectedExecution] = useState<number | null>(
    null,
  );

  const [executionList, setExecutionList] = useState<LogEntity[]>([]);

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
  }, [ikApi, entityId, traceId, setExecutionList, setSelectedExecution]);

  useEffectOnce(() => {
    fetchLogsExecutionTime();
  });

  return (
    <Box>
      {selectedExecution && (
        <LogView
          key={selectedExecution}
          entity_id={entityId}
          execution_time={selectedExecution}
        />
      )}
      {executionList.length === 0 && <Box>No logs available.</Box>}
    </Box>
  );
};
