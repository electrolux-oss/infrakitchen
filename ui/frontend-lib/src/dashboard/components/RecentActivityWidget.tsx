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
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";

import { Entity } from "../../common/components/entities/Entity";
import {
  dataGridClickableRowSx,
  dataGridDefaultProps,
  dataGridSx,
} from "../../common/components/entity_table/dataGridStyles";
import { RELATIVE_TIME_COLUMN_WIDTH } from "../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
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
        renderCell: (params: GridRenderCellParams<ActivityLogEntry>) => {
          const status = activityStatus(
            params.row.action,
            params.row.entityData?.status,
          );
          const Icon = STATUS_ICONS[status];
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Icon
                fontSize="small"
                sx={{ color: STATUS_COLORS[status], flexShrink: 0 }}
              />
              <span>{humanizeAction(params.row.action)}</span>
            </Box>
          );
        },
      },
      {
        field: "entity",
        headerName: "Entity",
        flex: 2,
        valueGetter: (_value, row) => row.entityData?.name ?? row.entityId,
        renderCell: (params: GridRenderCellParams<ActivityLogEntry>) => (
          <Entity
            entity={{
              ...params.row.entityData,
              id: params.row.entityId,
              entityType: params.row.model,
              name: params.row.entityData?.name ?? params.row.entityId,
            }}
            showLabel
          />
        ),
      },
      {
        field: "creator",
        headerName: "User",
        flex: 1,
        valueGetter: (_value, row) =>
          row.creator?.displayName ?? row.creator?.identifier ?? "System",
        renderCell: (params: GridRenderCellParams<ActivityLogEntry>) => {
          const creator = params.row.creator;
          if (!creator) return <span>System</span>;
          return (
            <Entity
              entity={{
                ...creator,
                entityType: "user",
                name: creator.displayName || creator.identifier,
              }}
            />
          );
        },
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

  const handleRowClick = (
    params: { row: ActivityLogEntry },
    event?: React.MouseEvent<HTMLElement>,
  ) => {
    // The entity name cell renders its own link (via the shared Entity
    // component); let it navigate to the entity page instead of also
    // triggering the row's audit-page navigation.
    if ((event?.target as Element | undefined)?.closest("a")) return;
    const { row } = params;
    void navigate(`${linkPrefix}${row.model}s/${row.entityId}/audit`);
  };

  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
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
