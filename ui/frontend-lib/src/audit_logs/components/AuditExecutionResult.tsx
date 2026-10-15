import { Label } from "../../common/components/labels/Label";
import { Divider, Chip, Tooltip, type ChipColor } from "../../ui";
import { cn } from "../../utils/cn";
import type { GqlAuditLog } from "../graphql";

// Counts of a plan ("add") or apply ("added") with the affected resource addresses.
type ChangeCounts = {
  resources?: Record<string, string[]>;
  resources_truncated?: boolean;
  [key: string]: unknown;
};

export interface AuditExecution {
  // warning: the entity is fine but a side effect failed (e.g. workspace sync)
  status: "running" | "success" | "failed" | "warning" | "retry";
  entity?: string;
  action?: string;
  worker?: string;
  attempt?: number;
  started_at?: string;
  finished_at?: string;
  duration_seconds?: number;
  error?: string;
  details?: {
    operation?: string;
    plan?: ChangeCounts;
    apply?: ChangeCounts;
    destroy?: ChangeCounts;
    pull_request?: string;
    changes_committed?: boolean;
    variables?: number;
    outputs?: number;
    new_tags?: string[];
    new_branches?: string[];
    drift?: Record<string, string[]>;
    [key: string]: unknown;
  };
}

// Splits a segment like "plan +1 ~0 -2" or "applied +2 ~0 -1" into three
// whitespace-separated chunks; "destroyed 4" keeps its count with the minus
// chunk so destructive actions always surface in red.
const TOFU_COUNT_RE = /^(\S+) (\+\d+) (~\d+) ([-]\d+)$/;

const TOFU_CHUNK_COLOR: [RegExp, string][] = [
  [/^\+/, "text-success"],
  [/^~/, "text-warning"],
  [/^-/, "text-error"],
];

const chunkColor = (chunk: string): string | null => {
  for (const [re, color] of TOFU_CHUNK_COLOR) {
    if (re.test(chunk)) return color;
  }
  return null;
};

export const getAuditExecution = (
  log: Pick<GqlAuditLog, "metadata">,
): AuditExecution | undefined => {
  const execution = log.metadata?.execution as AuditExecution | undefined;
  return execution?.status ? execution : undefined;
};

// "+add ~change -destroy" from plan ("add") or apply ("added") counts.
const formatChanges = (
  changes: ChangeCounts,
  [add, change, destroy]: [string, string, string],
) =>
  `+${Number(changes[add] ?? 0)} ~${Number(changes[change] ?? 0)} -${Number(changes[destroy] ?? 0)}`;

// Short one-line outcome of the task, e.g. "plan +1 ~0 -2" or "PR created".
// Returns segments so the calls can colorize +adds (green), ~changes
// (amber) and -destroys (red) individually.
export const formatExecutionSummarySegments = (
  execution: AuditExecution,
): string[] => {
  const details = execution.details ?? {};
  const parts: string[] = [];

  if (details.apply)
    parts.push(
      `applied ${formatChanges(details.apply, ["added", "changed", "destroyed"])}`,
    );
  else if (details.destroy)
    parts.push(`destroyed ${Number(details.destroy.destroyed ?? 0)}`);
  else if (details.plan)
    parts.push(
      details.plan.has_changes
        ? `plan ${formatChanges(details.plan, ["add", "change", "destroy"])}`
        : "no changes",
    );

  if (details.pull_request)
    parts.push(`PR ${details.pull_request.replace("_", " ")}`);
  else if (details.changes_committed === false) parts.push("nothing to commit");

  if (details.variables !== undefined)
    parts.push(`${details.variables} vars, ${details.outputs ?? 0} outputs`);
  if (details.drift) {
    const files = Object.values(details.drift).reduce(
      (n, f) => n + f.length,
      0,
    );
    parts.push(`drift in ${files} file${files === 1 ? "" : "s"}`);
  }
  if (details.new_tags?.length)
    parts.push(`${details.new_tags.length} new tags`);
  if (details.new_branches?.length)
    parts.push(`${details.new_branches.length} new branches`);

  if (parts.length === 0 && execution.error) parts.push(execution.error);

  return parts;
};

export const formatExecutionSummary = (execution: AuditExecution): string =>
  formatExecutionSummarySegments(execution).join(" · ");

// Planned actions in display order, with the color of their chip.
const RESOURCE_ACTIONS: [string, string, ChipColor][] = [
  ["create", "Create", "success"],
  ["update", "Update in-place", "warning"],
  ["replace", "Replace", "error"],
  ["destroy", "Destroy", "error"],
  ["import", "Import", "info"],
  ["move", "Move", "info"],
  ["read", "Read during apply", "default"],
  ["forget", "Remove from state", "default"],
  ["drift", "Changed outside of tofu", "warning"],
];

// Max resource addresses rendered per action group before collapsing the
// rest into a "+N more" line, so large plans can't turn the tooltip into a
// wall while every action still gets fair visibility (a global cap could
// hide a whole group, e.g. a small Destroy buried under a large Create).
const MAX_ROWS_PER_GROUP = 5;

const getTofuResult = (execution: AuditExecution): ChangeCounts | undefined =>
  execution.details?.apply ??
  execution.details?.destroy ??
  execution.details?.plan;

// Grouped address rows, e.g. one "4 Create" header followed by up to
// MAX_ROWS_PER_GROUP addresses — less noisy than a chip on every row.
const ResourceActionGroup = ({
  label,
  count,
  color,
  addresses,
}: {
  label: string;
  count: number;
  color: ChipColor;
  addresses: string[];
}) => {
  const shown = addresses.slice(0, MAX_ROWS_PER_GROUP);
  const hidden = addresses.length - shown.length;
  return (
    <div className="flex flex-col gap-1">
      <Chip
        className="self-start font-semibold"
        label={`${count} ${label}`}
        color={color}
        variant="outlined"
        size="small"
      />
      {shown.map((address) => (
        <span
          className="ml-2 min-w-0 font-mono text-[0.8125rem] font-normal tracking-[0.01em] break-all"
          key={address}
        >
          {address}
        </span>
      ))}
      {hidden > 0 && (
        <span className="ml-2 text-caption text-fg-muted">
          {`+${hidden} more`}
        </span>
      )}
    </div>
  );
};

// Show up to MAX_ROWS_PER_GROUP addresses per action, with a per-group
// "more" line when truncated. Group header counts stay honest either way.
const ExecutionResources = ({ result }: { result: ChangeCounts }) => {
  const groups = RESOURCE_ACTIONS.flatMap(
    ([action, label, color]): {
      label: string;
      count: number;
      color: ChipColor;
      addresses: string[];
    }[] => {
      const addresses = result.resources?.[action] ?? [];
      return addresses.length
        ? [{ label, count: addresses.length, color, addresses }]
        : [];
    },
  );

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <ResourceActionGroup
          key={group.label}
          label={group.label}
          count={group.count}
          color={group.color}
          addresses={group.addresses}
        />
      ))}
      {result.resources_truncated && (
        <span className="text-caption text-fg-muted">
          The list is truncated.
        </span>
      )}
    </div>
  );
};

const formatDuration = (seconds: number) =>
  seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

const ExecutionTooltip = ({
  execution,
  tofuResult,
}: {
  execution: AuditExecution;
  tofuResult?: ChangeCounts;
}) => {
  const rows: [string, string][] = [];
  if (execution.entity)
    rows.push(["Task", `${execution.entity} ${execution.action ?? ""}`]);
  if (execution.details?.operation)
    rows.push(["Operation", execution.details.operation]);
  if (execution.duration_seconds !== undefined)
    rows.push(["Duration", formatDuration(execution.duration_seconds)]);
  if (execution.attempt && execution.attempt > 1)
    rows.push(["Attempt", String(execution.attempt)]);
  if (execution.worker) rows.push(["Worker", execution.worker]);
  for (const key of [
    "tool",
    "source_code_version",
    "ref",
    "repository",
    "branch",
  ]) {
    const value = execution.details?.[key];
    if (value) rows.push([key.replace(/_/g, " "), String(value)]);
  }
  if (execution.error) rows.push(["Error", execution.error]);

  return (
    <div className="flex flex-col gap-2 py-1">
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2">
        {rows.map(([label, value]) => (
          <div className="contents" key={label}>
            <dt
              // Muted label style shared with the overview card fields:
              // the value is the visual anchor, not the label.
              className="text-[0.8125rem] font-medium text-fg-muted capitalize"
            >
              {label}
            </dt>
            <dd className="m-0 [word-break:break-word]">{value}</dd>
          </div>
        ))}
      </dl>
      {tofuResult && Object.keys(tofuResult.resources ?? {}).length > 0 && (
        <>
          <Divider />
          <ExecutionResources result={tofuResult} />
        </>
      )}
    </div>
  );
};

export const AuditExecutionResult = ({
  log,
  hideSummary = false,
}: {
  log: Pick<GqlAuditLog, "metadata">;
  hideSummary?: boolean;
}) => {
  const execution = getAuditExecution(log);
  if (!execution) return null;

  const segments = hideSummary ? [] : formatExecutionSummarySegments(execution);
  const tofuResult = getTofuResult(execution);

  return (
    <div className="flex h-full min-w-0 items-center gap-1">
      <Tooltip
        title={
          <ExecutionTooltip execution={execution} tofuResult={tofuResult} />
        }
        placement="bottom-start"
        className="w-max max-w-[520px]"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Label
            label={
              execution.status === "failed"
                ? "Failure"
                : execution.status === "warning"
                  ? "Warning"
                  : execution.status === "running" ||
                      execution.status === "retry"
                    ? "Running"
                    : "Success"
            }
            tone={
              execution.status === "failed"
                ? "error"
                : execution.status === "warning"
                  ? "warning"
                  : execution.status === "running" ||
                      execution.status === "retry"
                    ? "info"
                    : "success"
            }
          />
          {segments.length > 0 && (
            <p
              className={cn(
                "m-0 truncate text-body2",
                execution.status === "failed"
                  ? "text-error"
                  : execution.status === "warning"
                    ? "text-warning"
                    : "text-fg-muted",
              )}
            >
              {segments.map((seg, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {TOFU_COUNT_RE.test(seg) || /^destroyed \d+$/.test(seg)
                    ? seg.split(" ").map((chunk, j) => (
                        <span
                          className={cn(j > 0 && "ml-1", chunkColor(chunk))}
                          key={j}
                        >
                          {chunk}
                        </span>
                      ))
                    : seg}
                </span>
              ))}
            </p>
          )}
        </div>
      </Tooltip>
    </div>
  );
};
