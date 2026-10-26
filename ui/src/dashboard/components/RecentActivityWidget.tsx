import React, { useMemo } from "react";

import { useNavigate } from "react-router";

import {
  AuditExecutionResult,
  getAuditExecution,
} from "../../audit_logs/components/AuditExecutionResult";
import {
  Entity,
  humanizeEntityType,
} from "../../common/components/entities/Entity";
import { entityIcons } from "../../common/components/entities/entityIcons";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { paletteTextClass } from "../../common/utils";
import { HeroArrowUturnLeftIcon, HeroCheckCircleIcon } from "../../icons";
import {
  HeroClockIcon,
  HeroExclamationCircleIcon,
  HeroExclamationTriangleIcon,
} from "../../icons";
import { Divider, Spinner, Button, useMediaQuery } from "../../ui";
import { DataTable, DataTableColumn, RenderCellParams } from "../../ui";
import { Label } from "../../ui/Label";
import { cn } from "../../utils/cn";
import { ActivityLogEntry } from "../types";

export interface RecentActivityWidgetProps {
  activities: ActivityLogEntry[];
  loading?: boolean;
  loadingMore?: boolean;
  hasFavorites?: boolean;
  /** Total number of matching audit logs (from auditLogsCount), if known. */
  total?: number;
  /** Fetches and appends the next page of activities. */
  onLoadMore?: () => void;
}

// Maps internal action names (e.g. `dryrun_with_temp_state`) to friendly
// past-tense verbs.
const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  edit: "Updated",
  destroy: "Destroyed",
  delete: "Deleted",
  reject: "Rejected",
  approve: "Approved",
  execute: "Executed",
  retry: "Retried",
  recreate: "Recreated",
  sync: "Synced",
  dryrun: "Dry-run",
  dryrun_with_temp_state: "Dry-run (temp state)",
  disable: "Disabled",
  enable: "Enabled",
  download: "Downloaded",
  cascade_destroy: "Cascade destroyed",
  cascade_dryrun: "Cascade planned",
  cascade_execute: "Cascade applied",
};

function humanizeAction(action?: string): string {
  if (!action) return "";
  const lower = action.toLowerCase();
  if (ACTION_LABELS[lower]) return ACTION_LABELS[lower];
  return lower
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type ActivityStatus = "success" | "failure" | "warning" | "pending";

const EXECUTION_STATUS: Record<string, ActivityStatus> = {
  success: "success",
  failed: "failure",
  warning: "warning",
  retry: "pending",
  running: "pending",
};

function activityStatus(
  action?: string,
  entityStatus?: string,
  executionStatus?: string,
): ActivityStatus {
  // the result of the task triggered by this event, the entity status is its current one
  if (executionStatus && EXECUTION_STATUS[executionStatus]) {
    return EXECUTION_STATUS[executionStatus];
  }
  if (entityStatus) {
    if (["error"].includes(entityStatus)) return "failure";
    if (
      ["in_progress", "queued", "pending", "approval_pending"].includes(
        entityStatus,
      )
    )
      return "pending";
    if (["done", "ready", "enabled", "provisioned"].includes(entityStatus))
      return "success";
  }
  if (
    action?.toLowerCase().includes("failure") ||
    action?.toLowerCase().includes("error")
  ) {
    return "failure";
  }
  if (
    action?.toLowerCase().includes("pending") ||
    action?.toLowerCase().includes("in_progress")
  ) {
    return "pending";
  }
  return "success";
}

const STATUS_ICONS = {
  success: HeroCheckCircleIcon,
  failure: HeroExclamationCircleIcon,
  warning: HeroExclamationTriangleIcon,
  pending: HeroClockIcon,
} as const;

const STATUS_COLORS = {
  success: "success.main",
  failure: "error.main",
  warning: "warning.main",
  pending: "warning.main",
} as const;

const ActivityEvent = ({ activity }: { activity: ActivityLogEntry }) => {
  const status = activityStatus(
    activity.action,
    activity.entityData?.status,
    getAuditExecution(activity)?.status,
  );
  const Icon = STATUS_ICONS[status];
  return (
    <div className="flex items-center gap-2">
      <Icon
        fontSize="small"
        className={cn("shrink-0", paletteTextClass(STATUS_COLORS[status]))}
      />
      <span>{humanizeAction(activity.action)}</span>
    </div>
  );
};

const ActivityEntity = ({
  activity,
  showLabel,
}: {
  activity: ActivityLogEntry;
  showLabel: boolean;
}) => (
  <Entity
    entity={{
      ...activity.entityData,
      id: activity.entityId,
      entityType: activity.model,
      name: activity.entityData?.name ?? activity.entityId,
    }}
    showLifecycleState={false}
    showLabel={showLabel}
  />
);

const ActivityCreator = ({ activity }: { activity: ActivityLogEntry }) => {
  const creator = activity.creator;
  if (!creator) return <span>System</span>;
  return (
    <Entity
      entity={{
        ...creator,
        entityType: "user",
        name: creator.displayName || creator.identifier,
      }}
      hideName
    />
  );
};

// Phone layout: the entity name gets the whole first line; event, entity
// type, user and time share a secondary line below it.
const ActivityCardList = ({
  activities,
  onRowClick,
}: {
  activities: ActivityLogEntry[];
  onRowClick: (row: ActivityLogEntry, event: React.MouseEvent) => void;
}) => (
  <div role="list">
    {activities.map((activity, index) => {
      const typeLabel =
        activity.entityData?.template?.name ||
        humanizeEntityType(activity.model);
      return (
        <div
          className={cn(
            "hover:bg-hover",
            cn(
              index === 0 ? "border-t-0" : "border-t",
              "border-t-divider",
              "cursor-pointer px-4 py-3 text-[0.875rem]",
            ),
          )}
          key={activity.id}
          role="listitem"
          onClick={(event) => onRowClick(activity, event)}
        >
          <div className="min-w-0 font-medium wrap-anywhere">
            <ActivityEntity activity={activity} showLabel={false} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-fg-muted">
            <ActivityEvent activity={activity} />
            {typeLabel && (
              <Label label={typeLabel} icon={entityIcons[activity.model]} />
            )}
            <AuditExecutionResult log={activity} />
            <div className="ml-auto flex items-center gap-2">
              <ActivityCreator activity={activity} />
              <RelativeTime className="flex" date={activity.createdAt} />
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

export const RecentActivityWidget = ({
  activities,
  loading = false,
  loadingMore = false,
  hasFavorites = false,
  total,
  onLoadMore,
}: RecentActivityWidgetProps) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();
  // Same breakpoint as EntityTable: a 4-column grid doesn't fit a phone, so
  // rows become stacked cards.
  const isMobile = useMediaQuery("(max-width: 599.95px)");

  const count = activities.length;
  const showingLabel = hasFavorites
    ? "Showing most recent activities on your favorites"
    : "Showing most recent activities across all resources";

  const hasMore =
    onLoadMore !== undefined && total !== undefined && count < total;

  const columns: DataTableColumn<ActivityLogEntry>[] = useMemo(
    () => [
      {
        field: "action",
        headerName: "Event",
        flex: 1.2,
        valueGetter: (_value, row) => humanizeAction(row.action),
        renderCell: (params: RenderCellParams<ActivityLogEntry>) => (
          <ActivityEvent activity={params.row} />
        ),
      },
      {
        field: "entity",
        headerName: "Entity",
        flex: 2,
        valueGetter: (_value, row) => row.entityData?.name ?? row.entityId,
        renderCell: (params: RenderCellParams<ActivityLogEntry>) => (
          <ActivityEntity activity={params.row} showLabel />
        ),
      },
      {
        field: "result",
        headerName: "Result",
        flex: 2.5,
        sortable: false,
        valueGetter: (_value, row) => getAuditExecution(row)?.status ?? "",
        renderCell: (params: RenderCellParams<ActivityLogEntry>) => (
          <AuditExecutionResult log={params.row} />
        ),
      },
      {
        field: "creator",
        headerName: "User",
        width: 150,
        valueGetter: (_value, row) =>
          row.creator?.displayName ?? row.creator?.identifier ?? "System",
        renderCell: (params: RenderCellParams<ActivityLogEntry>) => (
          <div className="flex w-full items-center justify-end gap-3">
            <RelativeTime
              className="flex"
              date={params.row.createdAt}
              compact
            />
            <ActivityCreator activity={params.row} />
          </div>
        ),
      },
    ],
    [],
  );

  const navigateToAudit = (
    row: ActivityLogEntry,
    event?: React.MouseEvent<Element>,
  ) => {
    // The entity name cell renders its own link (via the shared Entity
    // component); let it navigate to the entity page instead of also
    // triggering the row's audit-page navigation.
    if ((event?.target as Element | undefined)?.closest("a")) return;
    void navigate(`${linkPrefix}${row.model}s/${row.entityId}/audit`);
  };

  return (
    <div className="h-full w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <HeroArrowUturnLeftIcon className="text-[20px] text-primary" />
        <h6 className="m-0 text-subtitle1 font-semibold text-grey-500">
          Recent Activities
        </h6>
        {!loading && (
          <span className="ml-auto text-caption text-fg-muted">
            {showingLabel}
          </span>
        )}
      </div>
      <Divider className="mb-3" />
      <div className="overflow-hidden rounded-surface border border-divider bg-paper">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={24} />
          </div>
        ) : count === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-fg-muted">
            <HeroArrowUturnLeftIcon className="mb-2 text-[32px] opacity-50" />
            <p className="m-0 text-body2">
              No recent activities {hasFavorites ? "on your favorites." : "."}
            </p>
          </div>
        ) : isMobile ? (
          <ActivityCardList
            activities={activities}
            onRowClick={navigateToAudit}
          />
        ) : (
          <DataTable
            rows={activities}
            columns={columns}
            hideHeader
            hideFooter
            onRowClick={navigateToAudit}
          />
        )}
      </div>
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button
            size="small"
            variant="text"
            onClick={onLoadMore}
            disabled={loadingMore}
            startIcon={loadingMore ? <Spinner size={14} /> : undefined}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
};
