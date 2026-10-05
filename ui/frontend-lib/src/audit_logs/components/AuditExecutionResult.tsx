import { useState } from "react";

import ListAltIcon from "@mui/icons-material/ListAlt";
import {
  Box,
  Chip,
  ChipProps,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";

import { CommonDialog } from "../../common/components/dialogs/CommonDialog";
import { softChipColorSx } from "../../common/utils/softChip";
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

const STATUS_COLOR: Record<AuditExecution["status"], ChipProps["color"]> = {
  running: "info",
  success: "success",
  failed: "error",
  warning: "warning",
  retry: "warning",
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
export const formatExecutionSummary = (execution: AuditExecution): string => {
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

  return parts.join(" · ");
};

// Planned actions in display order, with the color of their chip.
const RESOURCE_ACTIONS: [string, string, ChipProps["color"]][] = [
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

const getTofuResult = (execution: AuditExecution): ChangeCounts | undefined =>
  execution.details?.apply ??
  execution.details?.destroy ??
  execution.details?.plan;

const ExecutionResources = ({ result }: { result: ChangeCounts }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
    {RESOURCE_ACTIONS.filter(
      ([action]) => result.resources?.[action]?.length,
    ).map(([action, label, color]) => (
      <Box key={action}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <Chip
            label={label.toUpperCase()}
            size="small"
            sx={softChipColorSx(color)}
          />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {result.resources![action].length}
          </Typography>
        </Box>
        <Box
          component="ul"
          sx={{ m: 0, pl: 2.5, fontFamily: "monospace", fontSize: "0.8125rem" }}
        >
          {result.resources![action].map((address) => (
            <li key={address} style={{ wordBreak: "break-all" }}>
              {address}
            </li>
          ))}
        </Box>
      </Box>
    ))}
    {result.resources_truncated && (
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        The list is truncated, see the logs for all resources.
      </Typography>
    )}
  </Box>
);

const formatDuration = (seconds: number) =>
  seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

const ExecutionTooltip = ({ execution }: { execution: AuditExecution }) => {
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
    <Box
      component="dl"
      sx={{
        m: 0,
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        columnGap: 1,
      }}
    >
      {rows.map(([label, value]) => (
        <Box key={label} sx={{ display: "contents" }}>
          <Box
            component="dt"
            sx={{ fontWeight: 600, textTransform: "capitalize" }}
          >
            {label}
          </Box>
          <Box component="dd" sx={{ m: 0, wordBreak: "break-word" }}>
            {value}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export const AuditExecutionResult = ({
  log,
  hideSummary = false,
}: {
  log: Pick<GqlAuditLog, "metadata">;
  hideSummary?: boolean;
}) => {
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const execution = getAuditExecution(log);
  if (!execution) return null;

  const summary = hideSummary ? "" : formatExecutionSummary(execution);
  const tofuResult = getTofuResult(execution);
  const hasResources = Object.keys(tofuResult?.resources ?? {}).length > 0;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        height: "100%",
        minWidth: 0,
      }}
    >
      <Tooltip
        title={<ExecutionTooltip execution={execution} />}
        placement="bottom-start"
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            minWidth: 0,
          }}
        >
          <Chip
            label={execution.status.toUpperCase()}
            size="small"
            sx={softChipColorSx(STATUS_COLOR[execution.status] ?? "default")}
          />
          {summary && (
            <Typography
              variant="caption"
              noWrap
              sx={{
                color:
                  execution.status === "failed"
                    ? "error.main"
                    : execution.status === "warning"
                      ? "warning.main"
                      : "text.secondary",
              }}
            >
              {summary}
            </Typography>
          )}
        </Box>
      </Tooltip>
      {hasResources && tofuResult && (
        <>
          <Tooltip title="Resources">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setResourcesOpen(true);
              }}
            >
              <ListAltIcon sx={{ fontSize: "1rem" }} />
            </IconButton>
          </Tooltip>
          {/* dialog events bubble through the React tree to the table row */}
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{ display: "contents" }}
          >
            <CommonDialog
              title="Resources"
              open={resourcesOpen}
              onClose={() => setResourcesOpen(false)}
              maxWidth="md"
              hasFooterActions={false}
              content={<ExecutionResources result={tofuResult} />}
            />
          </Box>
        </>
      )}
    </Box>
  );
};
