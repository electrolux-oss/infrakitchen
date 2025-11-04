import { useState, useCallback } from "react";

import { useLocation } from "react-router";
import { useEffectOnce } from "react-use";

import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@mui/material";

import { LogEntity, RevisionResponse } from "../../types";
import { getDateValue } from "../components/CommonField";
import { DialogSlider } from "../components/DialogSlider";
import { useConfig } from "../context/ConfigContext";

import { LogView } from "./LogView";

export const LogList = (props: { entity_id: string }) => {
  const { entity_id } = props;
  const { ikApi } = useConfig();

  const [selectedExecution, setSelectedExecution] = useState<number | null>(
    null,
  );

  const location = useLocation();

  const [executionList, setExecutionList] = useState<LogEntity[]>([]);
  const [revision, setRevision] = useState<RevisionResponse>();
  const [revisionNumber, setRevisionNumber] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const handleRevisionOpenDialog = () => {
    setOpen(true);
  };
  const handleRevisionCloseDialog = () => {
    setOpen(false);
  };
  const handleExecutionChange = (event: SelectChangeEvent<number>) => {
    setSelectedExecution(event.target.value as number);
    setRevisionNumber(
      executionList.find((exec) => exec.execution_start === event.target.value)
        ?.revision || null,
    );
  };

  const fetchRevision = (rev: string) => {
    ikApi
      .get(`revisions/${entity_id}/${rev}`)
      .then((response) => {
        setRevision(response);
        handleRevisionOpenDialog();
      })
      .catch((_) => {});
  };

  const fetchLogsExecutionTime = useCallback(async () => {
    const execution_start_result = await ikApi.get(
      `logs/execution_time/${entity_id}${location.search}`,
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
  }, [
    ikApi,
    entity_id,
    location,
    setExecutionList,
    setSelectedExecution,
    setRevisionNumber,
  ]);

  useEffectOnce(() => {
    fetchLogsExecutionTime();
  });

  return (
    <Box>
      {executionList.length > 0 && (
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, mt: 2 }}
        >
          <FormControl fullWidth sx={{ maxWidth: "600px" }}>
            <InputLabel id="execution-select-label">Execution</InputLabel>
            <Select
              labelId="execution-select-label"
              id="execution-select"
              value={selectedExecution || ""}
              label="Execution"
              onChange={handleExecutionChange}
            >
              {executionList.map((exec) => (
                <MenuItem key={exec.id} value={exec.execution_start}>
                  {getDateValue(new Date(exec.execution_start * 1000))}
                  {" - "}
                  {exec.data}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {revisionNumber && (
            <>
              <Button
                variant="outlined"
                onClick={() => fetchRevision(revisionNumber?.toString())}
              >
                Revision
              </Button>
              <DialogSlider
                open={open}
                onClose={handleRevisionCloseDialog}
                title="Revision Details"
              >
                {revision && (
                  <Box sx={{ padding: 2 }}>
                    <pre>{JSON.stringify(revision, null, 2)}</pre>
                  </Box>
                )}
              </DialogSlider>
            </>
          )}
        </Box>
      )}
      {selectedExecution && (
        <LogView
          key={selectedExecution}
          entity_id={entity_id}
          execution_time={selectedExecution}
        />
      )}
    </Box>
  );
};
