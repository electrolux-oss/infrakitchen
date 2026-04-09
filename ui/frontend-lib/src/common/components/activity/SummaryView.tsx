import { type SyntheticEvent, useCallback, useEffect, useState } from "react";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import Ansi from "ansi-to-react";

import { LogEntity } from "../../../types";
import { ENTITY_ACTION, ENTITY_STATUS } from "../../../utils/constants";
import { useConfig } from "../../context";
import StatusChip from "../../StatusChip";

type SummaryAction = "CREATE" | "DESTROY" | "UPDATE" | "REPLACE";
type ExecutionStatus = "DONE" | "ERROR" | "IN_PROGRESS";
type ChangeExecutionStatus = "IN_PROGRESS" | "COMPLETE" | "ERROR";

type SummaryChange = {
  id: string;
  address: string;
  action: SummaryAction;
  resourceType: string;
  resourceName: string;
  rawLines: string[];
  errorLines?: string[];
  executionStatus?: ChangeExecutionStatus;
};

type ErrorBlock = {
  address: string;
  lines: string[];
};

const ANSI_ESCAPE_RE = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

const stripAnsi = (line: string): string =>
  line.replace(ANSI_ESCAPE_RE, "").trim();

const isFatalErrorLine = (line: string): boolean => {
  return (
    /^fatal:/i.test(line) ||
    /^Command\s+'.+'\s+failed\s+with\s+exit\s+code\s+\d+/i.test(line) ||
    /^Unhandled exception occurred$/i.test(line)
  );
};

const parseResourceHeader = (
  line: string,
): { address: string; action: SummaryAction } | null => {
  const sanitized = stripAnsi(line);

  const createdMatch = sanitized.match(/^#\s+([^\s]+)\s+will\s+be\s+created$/);
  if (createdMatch) {
    return { address: createdMatch[1], action: "CREATE" };
  }

  const updatedMatch = sanitized.match(
    /^#\s+([^\s]+)\s+will\s+be\s+updated\s+in-place$/,
  );
  if (updatedMatch) {
    return { address: updatedMatch[1], action: "UPDATE" };
  }

  const destroyedMatch = sanitized.match(
    /^#\s+([^\s]+)\s+will\s+be\s+destroyed$/,
  );
  if (destroyedMatch) {
    return { address: destroyedMatch[1], action: "DESTROY" };
  }

  const replacedMatch = sanitized.match(
    /^#\s+([^\s]+)\s+must\s+be\s+replaced$/,
  );
  if (replacedMatch) {
    return { address: replacedMatch[1], action: "REPLACE" };
  }

  return null;
};

const getStatusChipValue = (status?: ExecutionStatus): string => {
  const normalizedStatus = String(status ?? "")
    .trim()
    .toUpperCase();

  switch (normalizedStatus) {
    case "ERROR":
      return ENTITY_STATUS.ERROR;
    case "IN_PROGRESS":
      return ENTITY_STATUS.IN_PROGRESS;
    case "DONE":
      return ENTITY_STATUS.DONE;
    default:
      return ENTITY_STATUS.UNKNOWN;
  }
};

const getChangeExecutionChip = (executionStatus?: ChangeExecutionStatus) => {
  if (executionStatus === "ERROR") {
    return { label: "Error", color: "error" as const };
  }

  if (executionStatus === "IN_PROGRESS") {
    return { label: "In progress", color: "info" as const };
  }

  if (executionStatus === "COMPLETE") {
    return { label: "Complete", color: "success" as const };
  }

  return null;
};

const stripBoxPrefix = (s: string): string => s.replace(/^[│╷╵]\s*/, "");

const collectErrorBlocks = (lines: string[]): ErrorBlock[] => {
  const blocks: ErrorBlock[] = [];
  const withPattern = /^with\s+([^,]+),$/;

  let inErrorBlock = false;
  let pendingBlock: string[] | null = null;
  let currentBlock: string[] = [];
  let currentAddress: string | null = null;

  for (const line of lines) {
    const clean = stripAnsi(line);
    const inner = stripBoxPrefix(clean);

    if (!inErrorBlock) {
      if (clean === "╷") {
        // Buffer until we know if this is Error or Warning.
        pendingBlock = [line];
        continue;
      }

      if (pendingBlock !== null) {
        if (/^Error:\s*/.test(inner)) {
          // Commit as error block.
          inErrorBlock = true;
          currentBlock = [...pendingBlock, line];
          currentAddress = null;
          pendingBlock = null;
        } else if (/^Warning:\s*/.test(inner) || clean === "╵") {
          // Warning block or immediately closed box — discard.
          pendingBlock = null;
        } else {
          // Blank │ lines before the content line — keep buffering.
          pendingBlock.push(line);
        }
        continue;
      }

      // Plain (non-box) Error: line.
      if (/^Error:\s*/.test(clean) || /^Error:\s*/.test(inner)) {
        inErrorBlock = true;
        currentBlock = [line];
        currentAddress = null;
      }
      continue;
    }

    currentBlock.push(line);
    const withMatch = inner.match(withPattern);
    if (withMatch) {
      currentAddress = withMatch[1].trim();
    }

    if (clean === "╵") {
      if (currentAddress) {
        blocks.push({
          address: stripAnsi(currentAddress).trim(),
          lines: [...currentBlock],
        });
      }
      inErrorBlock = false;
      currentBlock = [];
      currentAddress = null;
    }
  }

  return blocks;
};

const collectExecutionStatuses = (
  lines: string[],
): Map<string, ChangeExecutionStatus> => {
  const statuses = new Map<string, ChangeExecutionStatus>();

  const progressPattern =
    /^([^\s:][^:]*):\s*(Creating|Modifying|Destroying)\.\.\./i;
  const completePattern =
    /^([^\s:][^:]*):\s*(Creation|Modifications|Destruction) complete/i;

  for (const line of lines) {
    const clean = stripAnsi(line);

    const progressMatch = clean.match(progressPattern);
    if (progressMatch) {
      statuses.set(progressMatch[1], "IN_PROGRESS");
      continue;
    }

    const completeMatch = clean.match(completePattern);
    if (completeMatch) {
      statuses.set(completeMatch[1], "COMPLETE");
    }
  }

  return statuses;
};

const parsePlanSummary = (
  logs: LogEntity[],
  trackExecution: boolean,
): SummaryChange[] => {
  const lines = logs.map((l) => l.data ?? "");
  const result: SummaryChange[] = [];

  for (let i = 0; i < lines.length; i++) {
    const header = parseResourceHeader(lines[i]);
    if (!header) {
      continue;
    }

    const addressParts = header.address.split(".");
    const resourceName =
      addressParts[addressParts.length - 1] || header.address;
    const resourceType =
      addressParts.length > 1
        ? addressParts[addressParts.length - 2]
        : "resource";

    const rawLines: string[] = [lines[i]];
    let braceDepth = 0;
    let startedBlock = false;

    for (let j = i + 1; j < lines.length; j++) {
      const currentLine = lines[j];
      const cleanCurrent = stripAnsi(currentLine);

      if (cleanCurrent.startsWith("# ") && parseResourceHeader(currentLine)) {
        i = j - 1;
        break;
      }

      if (cleanCurrent.startsWith("Plan:")) {
        i = j - 1;
        break;
      }

      rawLines.push(currentLine);

      for (const ch of cleanCurrent) {
        if (ch === "{") {
          braceDepth += 1;
          startedBlock = true;
        } else if (ch === "}") {
          braceDepth = Math.max(0, braceDepth - 1);
        }
      }

      if (startedBlock && braceDepth === 0) {
        i = j;
        break;
      }
    }

    result.push({
      id: `${header.address}-${result.length}`,
      address: header.address,
      action: header.action,
      resourceType,
      resourceName,
      rawLines,
    });
  }

  if (trackExecution) {
    const executionStatuses = collectExecutionStatuses(lines);
    for (const change of result) {
      const executionStatus = executionStatuses.get(change.address);
      if (executionStatus) {
        change.executionStatus = executionStatus;
      }
    }

    const errorBlocks = collectErrorBlocks(lines);
    const errorByAddress = new Map<string, string[]>();

    for (const block of errorBlocks) {
      errorByAddress.set(block.address, block.lines);
    }

    for (const change of result) {
      const normalisedAddress = stripAnsi(change.address).trim();
      const errorLines =
        errorByAddress.get(normalisedAddress) ??
        [...errorByAddress.entries()].find(
          ([k]) => k.trim() === normalisedAddress,
        )?.[1];
      if (errorLines) {
        change.executionStatus = "ERROR";
        change.errorLines = errorLines;
      }
    }
  }

  return result;
};

const getActionColor = (action: SummaryAction) => {
  if (action === "CREATE") return "success" as const;
  if (action === "DESTROY" || action === "REPLACE") return "error" as const;
  if (action === "UPDATE") return "warning" as const;
  return "info" as const;
};

export const SummaryView = (props: {
  entityId: string;
  traceId: string;
  eventAction?: string;
  refreshKey?: number;
  onOpenLogs?: () => void;
}) => {
  const { entityId, traceId, eventAction, refreshKey, onOpenLogs } = props;
  const { ikApi } = useConfig();

  const [allLogs, setAllLogs] = useState<LogEntity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | false>(false);
  const [status, setStatus] = useState<ExecutionStatus | undefined>(undefined);

  const fetchAllLogsForExecution = useCallback(
    async (executionStart: number): Promise<LogEntity[]> => {
      const perPage = 1000;
      let page = 1;
      const collected: LogEntity[] = [];

      while (true) {
        const pageResult = await ikApi.getList("logs", {
          filter: { entity_id: entityId, execution_start: executionStart },
          pagination: { page, perPage },
          sort: { field: "created_at", order: "ASC" },
        });

        const chunk = pageResult.data || [];
        if (chunk.length === 0) {
          break;
        }

        collected.push(...chunk);

        if (chunk.length < perPage) {
          break;
        }

        page += 1;
      }

      return collected;
    },
    [ikApi, entityId],
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

    if (selectedExec) {
      const logsForExecution = await fetchAllLogsForExecution(selectedExec);
      setAllLogs(logsForExecution);
    } else {
      setAllLogs([]);
    }
    setLoaded(true);
  }, [ikApi, entityId, traceId, fetchAllLogsForExecution]);

  useEffect(() => {
    void fetchLogsExecutionTime();
  }, [fetchLogsExecutionTime, refreshKey]);

  useEffect(() => {
    if (!loaded || allLogs.length === 0 || !eventAction) {
      setStatus(undefined);
      return;
    }

    const lines = allLogs.map((l) => stripAnsi(l.data ?? ""));
    if (
      lines.some(
        (line) =>
          (/^(│\s*)?Error:\s*/.test(line) &&
            !/^(│\s*)?Warning:\s*/.test(line)) ||
          isFatalErrorLine(line),
      )
    ) {
      setStatus("ERROR");
      return;
    }

    if (eventAction === ENTITY_ACTION.EXECUTE) {
      if (
        lines.some((line) => /^(Apply|Destroy) complete!/i.test(line)) ||
        lines.some((line) => /task is done$/i.test(line))
      ) {
        setStatus("DONE");
      } else {
        setStatus("IN_PROGRESS");
      }
      return;
    }

    if (
      lines.some((line) => /^Plan:/i.test(line)) ||
      lines.some((line) => /^No changes\./i.test(line))
    ) {
      setStatus("DONE");
    } else {
      setStatus("IN_PROGRESS");
    }
  }, [allLogs, loaded, eventAction]);

  const changes = parsePlanSummary(
    allLogs,
    eventAction === ENTITY_ACTION.EXECUTE,
  );
  const fatalErrorLines = allLogs
    .map((l) => l.data ?? "")
    .filter((line) => isFatalErrorLine(stripAnsi(line)));

  const handleAccordionChange =
    (id: string) => (_: SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? id : false);
    };

  return (
    <Box
      sx={{
        height: "calc(100vh - 300px)",
        minHeight: 400,
        maxHeight: "80vh",
        overflowY: "auto",
        p: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {!loaded ? (
        <Typography color="text.secondary">Loading...</Typography>
      ) : allLogs.length === 0 ? (
        <Typography color="text.secondary">No logs available.</Typography>
      ) : (
        <>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 0.5, mb: 2 }}
          >
            <Typography variant="body2">
              <Box component="span" sx={{ fontWeight: 600 }}>
                Status:
              </Box>{" "}
              <Box
                component="span"
                sx={{ display: "inline-flex", verticalAlign: "middle" }}
              >
                {status !== undefined && (
                  <StatusChip status={getStatusChipValue(status)} />
                )}
              </Box>
            </Typography>
            {changes.length > 0 && (
              <Stack direction="row" spacing={1}>
                {(
                  ["CREATE", "UPDATE", "REPLACE", "DESTROY"] as SummaryAction[]
                ).map((action) => {
                  const count = changes.filter(
                    (c) => c.action === action,
                  ).length;
                  if (count === 0) return null;
                  return (
                    <Chip
                      key={action}
                      label={`${count} ${action.charAt(0) + action.slice(1).toLowerCase()}`}
                      size="small"
                      color={getActionColor(action)}
                      variant="outlined"
                    />
                  );
                })}
              </Stack>
            )}
          </Stack>
          {fatalErrorLines.length > 0 && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              action={
                onOpenLogs && (
                  <Button color="inherit" size="small" onClick={onOpenLogs}>
                    View full logs
                  </Button>
                )
              }
            >
              <AlertTitle>Fatal error</AlertTitle>
              <Box
                sx={{
                  fontFamily: "monospace",
                  fontSize: "0.8rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {fatalErrorLines.map((line, index) => (
                  <div key={`fatal-${index}`}>
                    <Ansi>{line || " "}</Ansi>
                  </div>
                ))}
              </Box>
            </Alert>
          )}
          {changes.length === 0 && fatalErrorLines.length === 0 ? (
            <Typography color="text.secondary">
              No changes in summary.
            </Typography>
          ) : (
            changes.map((change) => (
              <Accordion
                key={change.id}
                expanded={expanded === change.id}
                onChange={handleAccordionChange(change.id)}
                variant="outlined"
                disableGutters
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 2,
                      width: "100%",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Chip
                        label={change.action}
                        size="small"
                        color={getActionColor(change.action)}
                        variant="outlined"
                        sx={{ minWidth: 100, fontWeight: 600 }}
                      />
                      <Typography
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "0.95rem",
                          fontWeight: 500,
                        }}
                      >
                        {change.resourceType}.{change.resourceName}
                      </Typography>
                    </Box>
                    {eventAction === ENTITY_ACTION.EXECUTE &&
                      (() => {
                        const executionChip = getChangeExecutionChip(
                          change.executionStatus,
                        );
                        if (!executionChip) return null;
                        return (
                          <Chip
                            label={executionChip.label}
                            size="small"
                            color={executionChip.color}
                            variant="outlined"
                            sx={{ minWidth: 110, fontWeight: 600 }}
                          />
                        );
                      })()}
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <Box
                    component="div"
                    sx={{
                      m: 0,
                      p: 1.5,
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      bgcolor: "background.default",
                      borderTop: "1px solid",
                      borderColor: "divider",
                      overflowX: "auto",
                    }}
                  >
                    <List dense>
                      {change.rawLines.map((line, index) => (
                        <ListItem disablePadding key={`${change.id}-${index}`}>
                          <ListItemText sx={{ margin: 0 }}>
                            <pre style={{ margin: 0 }}>
                              <Ansi>{line || " "}</Ansi>
                            </pre>
                          </ListItemText>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                  {change.errorLines && change.errorLines.length > 0 && (
                    <Box
                      sx={{
                        p: 1.5,
                        fontFamily: "monospace",
                        fontSize: "0.8rem",
                        borderTop: "2px solid",
                        borderColor: "error.main",
                        bgcolor: "error.lighter",
                        overflowX: "auto",
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
                      >
                        Error
                      </Typography>
                      <List dense>
                        {change.errorLines.map((line, i) => (
                          <ListItem
                            disablePadding
                            key={`${change.id}-err-${i}`}
                          >
                            <ListItemText sx={{ margin: 0 }}>
                              <pre style={{ margin: 0 }}>
                                <Ansi>{line || " "}</Ansi>
                              </pre>
                            </ListItemText>
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </>
      )}
    </Box>
  );
};
