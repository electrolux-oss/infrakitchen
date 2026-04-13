import {
  type ComponentType,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import ArrowForwardIosSharpIcon from "@mui/icons-material/ArrowForwardIosSharp";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PendingIcon from "@mui/icons-material/Pending";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Stack,
  type SvgIconProps,
  Typography,
  accordionSummaryClasses,
} from "@mui/material";
import Ansi from "ansi-to-react";

import { LogEntity } from "../../../types";
import { ENTITY_ACTION } from "../../../utils/constants";
import { useConfig } from "../../context";
import { RelativeTime } from "../RelativeTime";

import { LogLine } from "./LogLine";

const ExecutionAction = {
  CREATE: "CREATE",
  DESTROY: "DESTROY",
  UPDATE: "UPDATE",
  REPLACE: "REPLACE",
} as const;

// eslint-disable-next-line no-redeclare
type ExecutionAction = (typeof ExecutionAction)[keyof typeof ExecutionAction];

const ExecutionStatus = {
  COMPLETE: "COMPLETE",
  ERROR: "ERROR",
  IN_PROGRESS: "IN_PROGRESS",
} as const;

// eslint-disable-next-line no-redeclare
type ExecutionStatus = (typeof ExecutionStatus)[keyof typeof ExecutionStatus];

type SummaryChange = {
  id: string;
  address: string;
  action: ExecutionAction;
  resourceType: string;
  resourceName: string;
  rawLines: string[];
  errorLines?: string[];
  executionStatus?: ExecutionStatus;
  duration?: string;
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
): { address: string; action: ExecutionAction } | null => {
  const sanitized = stripAnsi(line);

  const createdMatch = sanitized.match(/^#\s+([^\s]+)\s+will\s+be\s+created$/);
  if (createdMatch) {
    return { address: createdMatch[1], action: ExecutionAction.CREATE };
  }

  const updatedMatch = sanitized.match(
    /^#\s+([^\s]+)\s+will\s+be\s+updated\s+in-place$/,
  );
  if (updatedMatch) {
    return { address: updatedMatch[1], action: ExecutionAction.UPDATE };
  }

  const destroyedMatch = sanitized.match(
    /^#\s+([^\s]+)\s+will\s+be\s+destroyed$/,
  );
  if (destroyedMatch) {
    return { address: destroyedMatch[1], action: ExecutionAction.DESTROY };
  }

  const replacedMatch = sanitized.match(
    /^#\s+([^\s]+)\s+must\s+be\s+replaced$/,
  );
  if (replacedMatch) {
    return { address: replacedMatch[1], action: ExecutionAction.REPLACE };
  }

  return null;
};

const executionStatusIcons: Record<
  ExecutionStatus,
  { color: "error" | "info" | "success"; icon: ComponentType<SvgIconProps> }
> = {
  [ExecutionStatus.ERROR]: { color: "error", icon: ErrorIcon },
  [ExecutionStatus.IN_PROGRESS]: { color: "info", icon: PendingIcon },
  [ExecutionStatus.COMPLETE]: { color: "success", icon: CheckCircleIcon },
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

type ExecutionStatusEntry = { status: ExecutionStatus; duration?: string };

const collectExecutionStatuses = (
  lines: string[],
): Map<string, ExecutionStatusEntry> => {
  const statuses = new Map<string, ExecutionStatusEntry>();

  const progressPattern =
    /^([^\s:][^:]*):\s*(Creating|Modifying|Destroying)\.\.\./i;
  const completePattern =
    /^([^\s:][^:]*):\s*(Creation|Modifications|Destruction) complete(?: after (\S+))?/i;

  for (const line of lines) {
    const clean = stripAnsi(line);

    const progressMatch = clean.match(progressPattern);
    if (progressMatch) {
      statuses.set(progressMatch[1], { status: ExecutionStatus.IN_PROGRESS });
      continue;
    }

    const completeMatch = clean.match(completePattern);
    if (completeMatch) {
      statuses.set(completeMatch[1], {
        status: ExecutionStatus.COMPLETE,
        duration: completeMatch[3],
      });
    }
  }

  return statuses;
};

// Collects raw lines belonging to a single resource block
const collectResourceBlock = (
  lines: string[],
  startIndex: number,
): { rawLines: string[]; endIndex: number } => {
  const rawLines: string[] = [];
  let braceDepth = 0;
  let startedBlock = false;

  for (let index = startIndex; index < lines.length; index++) {
    const currentLine = lines[index];
    const clean = stripAnsi(currentLine);

    if (clean.startsWith("# ") && parseResourceHeader(currentLine)) {
      return { rawLines, endIndex: index - 1 };
    }

    if (clean.startsWith("Plan:")) {
      return { rawLines, endIndex: index - 1 };
    }

    rawLines.push(currentLine);

    for (const char of clean) {
      if (char === "{") {
        braceDepth += 1;
        startedBlock = true;
      } else if (char === "}") {
        braceDepth = Math.max(0, braceDepth - 1);
      }
    }

    if (startedBlock && braceDepth === 0) {
      return { rawLines, endIndex: index };
    }
  }

  return { rawLines, endIndex: lines.length - 1 };
};

const parsePlanSummary = (
  logs: LogEntity[],
  trackExecution: boolean,
): SummaryChange[] => {
  const lines = logs.map((log) => log.data ?? "");
  const result: SummaryChange[] = [];

  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const header = parseResourceHeader(lines[lineIndex]);
    if (!header) {
      lineIndex++;
      continue;
    }

    const addressParts = header.address.split(".");
    const resourceName =
      addressParts[addressParts.length - 1] || header.address;
    const resourceType =
      addressParts.length > 1
        ? addressParts[addressParts.length - 2]
        : "resource";

    const { rawLines, endIndex } = collectResourceBlock(lines, lineIndex + 1);
    lineIndex = endIndex + 1;

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
      const entry = executionStatuses.get(change.address);
      if (entry) {
        change.executionStatus = entry.status;
        change.duration = entry.duration;
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
        change.executionStatus = ExecutionStatus.ERROR;
        change.errorLines = errorLines;
      }
    }
  }

  return result;
};

const getActionColor = (action: ExecutionAction) => {
  if (action === ExecutionAction.CREATE) return "success" as const;
  if (action === ExecutionAction.DESTROY || action === ExecutionAction.REPLACE)
    return "error" as const;
  if (action === ExecutionAction.UPDATE) return "warning" as const;
  return "info" as const;
};

const ExecutionStatusIcon = ({
  status,
  showLabel,
  duration,
  iconFirst,
}: {
  status: ExecutionStatus;
  showLabel?: boolean;
  duration?: string;
  iconFirst?: boolean;
}) => {
  const { icon: Icon, color } = executionStatusIcons[status];
  const icon = <Icon color={color} fontSize="small" />;
  const label = showLabel && (
    <Typography color={`${color}.main`} fontWeight={500}>
      {status}
    </Typography>
  );
  const durationText = duration && (
    <Typography variant="caption" color="text.secondary">
      {duration}
    </Typography>
  );
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      {iconFirst ? (
        <>
          {icon}
          {label}
          {durationText}
        </>
      ) : (
        <>
          {label}
          {durationText}
          {icon}
        </>
      )}
    </Box>
  );
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
  const [overallStatus, setOverallStatus] = useState<
    ExecutionStatus | undefined
  >(undefined);

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
      setOverallStatus(undefined);
      return;
    }

    const lines = allLogs.map((log) => stripAnsi(log.data ?? ""));
    if (
      lines.some(
        (line) =>
          (/^(│\s*)?Error:\s*/.test(line) &&
            !/^(│\s*)?Warning:\s*/.test(line)) ||
          isFatalErrorLine(line),
      )
    ) {
      setOverallStatus(ExecutionStatus.ERROR);
      return;
    }

    if (eventAction === ENTITY_ACTION.EXECUTE) {
      if (
        lines.some((line) => /^(Apply|Destroy) complete!/i.test(line)) ||
        lines.some((line) => /task is done$/i.test(line))
      ) {
        setOverallStatus(ExecutionStatus.COMPLETE);
      } else {
        setOverallStatus(ExecutionStatus.IN_PROGRESS);
      }
      return;
    }

    if (
      lines.some((line) => /^Plan:/i.test(line)) ||
      lines.some((line) => /^No changes\./i.test(line))
    ) {
      setOverallStatus(ExecutionStatus.COMPLETE);
    } else {
      setOverallStatus(ExecutionStatus.IN_PROGRESS);
    }
  }, [allLogs, loaded, eventAction]);

  const changes = parsePlanSummary(
    allLogs,
    eventAction === ENTITY_ACTION.EXECUTE,
  );
  const fatalErrorLines = allLogs
    .map((log) => log.data ?? "")
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
                {overallStatus !== undefined && (
                  <ExecutionStatusIcon
                    status={overallStatus}
                    showLabel
                    iconFirst
                  />
                )}
                {allLogs.length > 0 && (
                  <RelativeTime
                    date={allLogs[allLogs.length - 1].created_at}
                    sx={{
                      color: "text.secondary",
                      ml: 1.5,
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                    }}
                  />
                )}
              </Box>
            </Typography>
            {changes.length > 0 && (
              <Stack direction="row" spacing={1}>
                {Object.values(ExecutionAction).map((action) => {
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
                sx={{
                  "& + &": { borderTop: 0 },
                  "&:last-of-type": {
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={
                    <ArrowForwardIosSharpIcon sx={{ fontSize: "0.9rem" }} />
                  }
                  sx={{
                    flexDirection: "row-reverse",
                    minHeight: 0,
                    py: 0.5,
                    "&:hover": { bgcolor: "action.hover" },
                    [`&.${accordionSummaryClasses.expanded}`]: {
                      minHeight: 0,
                    },
                    [`& .${accordionSummaryClasses.expandIconWrapper}.${accordionSummaryClasses.expanded}`]:
                      {
                        transform: "rotate(90deg)",
                      },
                    [`& .${accordionSummaryClasses.content}`]: {
                      margin: "0 0 0 8px !important",
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      width: "100%",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                          fontSize: "0.85rem",
                          fontWeight: 500,
                        }}
                      >
                        {change.resourceType}.{change.resourceName}
                      </Typography>
                    </Box>
                    {eventAction === ENTITY_ACTION.EXECUTE &&
                      change.executionStatus && (
                        <ExecutionStatusIcon
                          status={change.executionStatus}
                          duration={change.duration}
                        />
                      )}
                  </Box>
                </AccordionSummary>
                <AccordionDetails
                  sx={{
                    p: 1.5,
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    bgcolor: "action.hover",
                    overflowX: "auto",
                  }}
                >
                  {change.rawLines.map((line, index) => (
                    <LogLine key={`${change.id}-${index}`} line={line} />
                  ))}
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
                      {change.errorLines.map((line, i) => (
                        <LogLine key={`${change.id}-err-${i}`} line={line} />
                      ))}
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
