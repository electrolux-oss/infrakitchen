import {
  type ComponentType,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Ansi from "ansi-to-react";

import { HeroCheckCircleIcon } from "../../icons";
import { HeroClockIcon, HeroExclamationCircleIcon } from "../../icons";
import { HeroChevronRightIcon } from "../../icons";
import type { IconProps } from "../../icons/createIcon";
import { GqlLog, buildLogsQuery } from "../../logs/graphql";
import { LogEntity } from "../../types";
import {
  Alert,
  AlertTitle,
  Button,
  Label,
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "../../ui";
import { cn } from "../../utils/cn";
import { ENTITY_ACTION } from "../../utils/constants";
import { RelativeTime } from "../components/fields/RelativeTime";
import { useConfig } from "../context";

import { LogLine } from "./LogLine";
import { ANSI_ESCAPE_RE, PlanDiff } from "./PlanDiff";

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

const stripAnsi = (line: string): string =>
  line.replace(ANSI_ESCAPE_RE, "").trim();

// Failure lines the task worker logs when a run is aborted (see task_worker.py handlers)
const WORKER_FAILURE_RE =
  /^(ExitWithoutSave|CannotProceed|CloudWrongCredentials|CloudExecutionError|AssertionError|IntegrityError|FileNotFoundError):/;

const isFatalErrorLine = (line: string): boolean => {
  return (
    /^fatal:/i.test(line) ||
    /^Command\s+'.+'\s+failed\s+with\s+exit\s+code\s+\d+/i.test(line) ||
    /^Unhandled exception occurred$/i.test(line) ||
    /^Task is timed out$/i.test(line) ||
    WORKER_FAILURE_RE.test(line)
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
  { color: "error" | "info" | "success"; icon: ComponentType<IconProps> }
> = {
  [ExecutionStatus.ERROR]: { color: "error", icon: HeroExclamationCircleIcon },
  [ExecutionStatus.IN_PROGRESS]: { color: "info", icon: HeroClockIcon },
  [ExecutionStatus.COMPLETE]: {
    color: "success",
    icon: HeroCheckCircleIcon,
  },
};

const STATUS_TEXT = {
  error: "text-error",
  info: "text-info",
  success: "text-success",
} as const;

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

const parsePlanSummary = (logs: LogEntity[]): SummaryChange[] => {
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
    <span className={cn("text-body2 font-medium", STATUS_TEXT[color])}>
      {status}
    </span>
  );
  const durationText = duration && (
    <span className="text-caption text-fg-muted">{duration}</span>
  );
  return (
    <span className="inline-flex items-center gap-1">
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
    </span>
  );
};

export const SummaryView = (props: {
  entityId: string;
  auditLogId?: string;
  traceId?: string;
  executionStart?: number;
  eventAction?: string;
  refreshKey?: number;
  onOpenLogs?: () => void;
}) => {
  const {
    entityId,
    auditLogId,
    traceId,
    executionStart,
    eventAction,
    refreshKey,
    onOpenLogs,
  } = props;
  const { ikApi } = useConfig();

  const [allLogs, setAllLogs] = useState<LogEntity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | false>(false);
  const [overallStatus, setOverallStatus] = useState<
    ExecutionStatus | undefined
  >(undefined);

  const fetchAllLogsForExecution = useCallback(async (): Promise<
    LogEntity[]
  > => {
    const perPage = 1000;
    let page = 1;
    const collected: LogEntity[] = [];

    const filter: Record<string, string | number> = { entity_id: entityId };
    if (auditLogId) {
      filter.audit_log_id = auditLogId;
    }
    if (executionStart) {
      filter.execution_start = executionStart;
    }
    if (traceId) {
      filter.trace_id = traceId;
    }

    while (true) {
      const response = await ikApi.graphqlRequest<{ logs: GqlLog[] }>(
        buildLogsQuery(["id", "level", "data", "created_at"]),
        {
          filter,
          sort: ["created_at", "ASC"],
          range: [(page - 1) * perPage, page * perPage],
        },
      );

      const chunk = response.logs || [];
      if (chunk.length === 0) {
        break;
      }

      collected.push(...chunk);

      if (chunk.length < perPage) {
        break;
      }

      page += 1;
    }

    setLoaded(true);
    return collected;
  }, [ikApi, entityId, auditLogId, traceId, executionStart]);

  useEffect(() => {
    fetchAllLogsForExecution().then((logs) => {
      setAllLogs(logs);
    });
  }, [fetchAllLogsForExecution, refreshKey]);

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

  const changes = useMemo(() => parsePlanSummary(allLogs), [allLogs]);
  const fatalErrorLines = useMemo(
    () =>
      allLogs
        .map((log) => log.data ?? "")
        .filter((line) => isFatalErrorLine(stripAnsi(line))),
    [allLogs],
  );

  const handleAccordionChange =
    (id: string) => (_: SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? id : false);
    };

  return (
    <div className="flex h-[calc(100vh_-_300px)] max-h-[80vh] min-h-100 flex-col overflow-y-auto p-2">
      {!loaded ? (
        <p className="m-0 text-body2 text-fg-muted">Loading...</p>
      ) : allLogs.length === 0 ? (
        <p className="m-0 text-body2 text-fg-muted">No logs available.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-row items-center justify-between px-1">
            <p className="m-0 text-body2">
              <span className="font-semibold">Status:</span>{" "}
              <span className="inline-flex align-middle">
                {overallStatus !== undefined && (
                  <ExecutionStatusIcon
                    status={overallStatus}
                    showLabel
                    iconFirst
                  />
                )}
                {allLogs.length > 0 && (
                  <RelativeTime
                    className="ml-3 flex items-center text-[0.8rem] text-fg-muted"
                    date={allLogs[allLogs.length - 1].createdAt}
                  />
                )}
              </span>
            </p>
            {changes.length > 0 && (
              <div className="flex flex-row gap-2">
                {Object.values(ExecutionAction).map((action) => {
                  const count = changes.filter(
                    (c) => c.action === action,
                  ).length;
                  if (count === 0) return null;
                  return (
                    <Label
                      key={action}
                      label={`${count} ${action.charAt(0) + action.slice(1).toLowerCase()}`}
                      tone={getActionColor(action)}
                    />
                  );
                })}
              </div>
            )}
          </div>
          {fatalErrorLines.length > 0 && (
            <Alert
              className="mb-4"
              severity="error"
              action={
                onOpenLogs && (
                  <Button
                    className="shrink-0 whitespace-nowrap"
                    color="inherit"
                    size="small"
                    onClick={onOpenLogs}
                  >
                    View full logs
                  </Button>
                )
              }
            >
              <AlertTitle>Fatal error</AlertTitle>
              <div className="font-mono text-[0.8rem] [word-break:break-word] whitespace-pre-wrap">
                {fatalErrorLines.map((line, index) => (
                  <div key={`fatal-${index}`}>
                    <Ansi>{line || " "}</Ansi>
                  </div>
                ))}
              </div>
            </Alert>
          )}
          {changes.length === 0 && fatalErrorLines.length === 0 ? (
            <p className="m-0 text-body2 text-fg-muted">
              No changes in summary.
            </p>
          ) : (
            changes.map((change) => (
              <Accordion
                className="[&:last-of-type]:rounded-b-none"
                key={change.id}
                expanded={expanded === change.id}
                onChange={handleAccordionChange(change.id)}
              >
                <AccordionSummary
                  iconFirst
                  contentClassName="my-0 ml-2"
                  className="min-h-0 py-1 hover:bg-hover"
                  expandIcon={
                    <HeroChevronRightIcon className="text-[0.9rem]" />
                  }
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Label
                        className="min-w-25 font-semibold"
                        label={change.action}
                        tone={getActionColor(change.action)}
                      />
                      <p className="m-0 font-mono text-[0.85rem] font-medium">
                        {change.resourceType}.{change.resourceName}
                      </p>
                    </div>
                    {change.duration && change.executionStatus && (
                      <ExecutionStatusIcon
                        status={change.executionStatus}
                        duration={change.duration}
                      />
                    )}
                  </div>
                </AccordionSummary>
                <AccordionDetails
                  className={cn(
                    "font-mono text-[0.8rem]",
                    expanded === change.id && "bg-hover p-3",
                  )}
                >
                  <PlanDiff lines={change.rawLines} />
                  {change.errorLines && change.errorLines.length > 0 && (
                    <div className="overflow-x-auto border-t-2 border-error p-3 font-mono text-[0.8rem]">
                      <span className="mb-1 block font-sans text-caption font-bold text-error">
                        Error
                      </span>
                      {change.errorLines.map((line, i) => (
                        <LogLine key={`${change.id}-err-${i}`} line={line} />
                      ))}
                    </div>
                  )}
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </>
      )}
    </div>
  );
};
