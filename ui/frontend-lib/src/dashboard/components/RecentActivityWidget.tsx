import React, { useMemo } from "react";

import { useNavigate } from "react-router";

import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import HistoryIcon from "@mui/icons-material/History";
import PendingOutlinedIcon from "@mui/icons-material/PendingOutlined";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";

import {
  Entity,
  humanizeEntityType,
} from "../../common/components/entities/Entity";
import {
  dataGridClickableRowSx,
  dataGridDefaultProps,
  dataGridSx,
} from "../../common/components/entity_table/dataGridStyles";
import {
  RELATIVE_TIME_COLUMN_WIDTH,
  USER_AVATAR_COLUMN_WIDTH,
} from "../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { Label } from "../../common/components/labels/Label";
import { useConfig } from "../../common/context/ConfigContext";
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
};

function humanizeAction(action?: string): string {
  if (!action) return "";
  const lower = action.toLowerCase();
  if (ACTION_LABELS[lower]) return ACTION_LABELS[lower];
  return lower
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type ActivityStatus = "success" | "failure" | "pending";

function activityStatus(
  action?: string,
  entityStatus?: string,
): ActivityStatus {
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
  success: CheckCircleOutlinedIcon,
  failure: ErrorOutlinedIcon,
  pending: PendingOutlinedIcon,
} as const;

const STATUS_COLORS = {
  success: "success.main",
  failure: "error.main",
  pending: "warning.main",
} as const;

const ActivityEvent = ({ activity }: { activity: ActivityLogEntry }) => {
  const status = activityStatus(activity.action, activity.entityData?.status);
  const Icon = STATUS_ICONS[status];
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Icon
        fontSize="small"
        sx={{ color: STATUS_COLORS[status], flexShrink: 0 }}
      />
      <span>{humanizeAction(activity.action)}</span>
    </Box>
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
  <Box role="list">
    {activities.map((activity, index) => {
      const typeLabel =
        activity.entityData?.template?.name ||
        humanizeEntityType(activity.model);
      return (
        <Box
          key={activity.id}
          role="listitem"
          onClick={(event) => onRowClick(activity, event)}
          sx={{
            px: 2,
            py: 1.5,
            borderTop: index === 0 ? "none" : "1px solid",
            borderTopColor: "divider",
            fontSize: "0.875rem",
            cursor: "pointer",
            "&:hover": { backgroundColor: "action.hover" },
          }}
        >
          <Box sx={{ fontWeight: 500, minWidth: 0, overflowWrap: "anywhere" }}>
            <ActivityEntity activity={activity} showLabel={false} />
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              columnGap: 1.5,
              rowGap: 0.5,
              mt: 0.75,
              color: "text.secondary",
              fontSize: "0.8125rem",
            }}
          >
            <ActivityEvent activity={activity} />
            {typeLabel && <Label label={typeLabel} />}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                ml: "auto",
              }}
            >
              <ActivityCreator activity={activity} />
              <RelativeTime
                date={activity.createdAt}
                sx={{ display: "flex" }}
              />
            </Box>
          </Box>
        </Box>
      );
    })}
  </Box>
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
  const theme = useTheme();
  // Same breakpoint as EntityTable: a 4-column grid doesn't fit a phone, so
  // rows become stacked cards.
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), {
    noSsr: true,
  });

  const count = activities.length;
  const showingLabel = hasFavorites
    ? "Showing most recent activities on your favorites"
    : "Showing most recent activities across all resources";

  const hasMore =
    onLoadMore !== undefined && total !== undefined && count < total;

  const columns: GridColDef<ActivityLogEntry>[] = useMemo(
    () => [
      {
        field: "action",
        headerName: "Event",
        flex: 1.2,
        valueGetter: (_value, row) => humanizeAction(row.action),
        renderCell: (params: GridRenderCellParams<ActivityLogEntry>) => (
          <ActivityEvent activity={params.row} />
        ),
      },
      {
        field: "entity",
        headerName: "Entity",
        flex: 2,
        valueGetter: (_value, row) => row.entityData?.name ?? row.entityId,
        renderCell: (params: GridRenderCellParams<ActivityLogEntry>) => (
          <ActivityEntity activity={params.row} showLabel />
        ),
      },
      {
        field: "creator",
        headerName: "User",
        // Avatar-only cell, so the column only needs to fit the avatar.
        width: USER_AVATAR_COLUMN_WIDTH,
        valueGetter: (_value, row) =>
          row.creator?.displayName ?? row.creator?.identifier ?? "System",
        renderCell: (params: GridRenderCellParams<ActivityLogEntry>) => (
          <ActivityCreator activity={params.row} />
        ),
      },
      {
        field: "createdAt",
        headerName: "When",
        width: RELATIVE_TIME_COLUMN_WIDTH,
        valueGetter: (_value, row) => new Date(row.createdAt).getTime(),
        renderCell: (params: GridRenderCellParams<ActivityLogEntry>) => (
          <RelativeTime date={params.row.createdAt} sx={{ display: "flex" }} />
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

  const handleRowClick = (
    params: { row: ActivityLogEntry },
    event?: React.MouseEvent<HTMLElement>,
  ) => navigateToAudit(params.row, event);

  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          mb: 1.5,
        }}
      >
        <HistoryIcon sx={{ color: "info.main", fontSize: 20 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Recent Activities
        </Typography>
        {!loading && (
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", ml: "auto" }}
          >
            {showingLabel}
          </Typography>
        )}
      </Box>
      <Divider sx={{ mb: 1.5 }} />
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "var(--template-surface-radius)",
          backgroundColor: "background.paper",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 4,
            }}
          >
            <CircularProgress size={24} />
          </Box>
        ) : count === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              py: 4,
              color: "text.secondary",
            }}
          >
            <HistoryIcon sx={{ fontSize: 32, mb: 1, opacity: 0.5 }} />
            <Typography variant="body2">
              No recent activities {hasFavorites ? "on your favorites." : "."}
            </Typography>
          </Box>
        ) : isMobile ? (
          <ActivityCardList
            activities={activities}
            onRowClick={navigateToAudit}
          />
        ) : (
          <DataGrid
            rows={activities}
            columns={columns}
            autoHeight
            disableRowSelectionOnClick
            // Rows arrive in small backend batches, so the default pagination
            // footer is misleading.
            hideFooter
            onRowClick={handleRowClick}
            {...dataGridDefaultProps}
            sx={{
              ...dataGridSx,
              ...dataGridClickableRowSx,
              // Compact widget list: hug rows instead of the shared min-height.
              minHeight: "auto",
              border: "none",
              bgcolor: "background.paper",
            }}
          />
        )}
      </Box>
      {hasMore && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
          <Button
            size="small"
            variant="text"
            onClick={onLoadMore}
            disabled={loadingMore}
            startIcon={loadingMore ? <CircularProgress size={14} /> : undefined}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </Box>
      )}
    </Box>
  );
};
