import { useMemo } from "react";

import { useNavigate } from "react-router";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import HistoryIcon from "@mui/icons-material/History";
import PendingIcon from "@mui/icons-material/Pending";
import { Box, CircularProgress, Divider, Typography } from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";

import { GetEntityLink } from "../../common/components/CommonField";
import { RelativeTime } from "../../common/components/RelativeTime";
import {
  dataGridClickableRowSx,
  dataGridDefaultProps,
  dataGridSx,
} from "../../common/components/entity_table/dataGridStyles";
import { useConfig } from "../../common/context/ConfigContext";

import { ActivityLogEntry } from "../types";

export interface RecentActivityWidgetProps {
  activities: ActivityLogEntry[];
  loading?: boolean;
  hasFavorites?: boolean;
}

// Maps raw API action values to a friendly past-tense verb so the feed reads
// like a sentence ("Created resource my-db …") instead of showing internal
// snake_case action names (e.g. `dryrun_with_temp_state`).
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
  // Fallback for any future action: ``provision_resource`` -> "Provision
  // resource".
  return lower
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ``resource`` -> "Resource", ``source_code_version`` -> "Source code
// version".
function humanizeModel(model?: string): string {
  if (!model) return "";
  return model
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
  success: CheckCircleIcon,
  failure: ErrorIcon,
  pending: PendingIcon,
} as const;

const STATUS_COLORS = {
  success: "success.main",
  failure: "error.main",
  pending: "warning.main",
} as const;

export const RecentActivityWidget = ({
  activities,
  loading = false,
  hasFavorites = false,
}: RecentActivityWidgetProps) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const displayedActivities = useMemo(() => {
    return activities.slice(0, 10);
  }, [activities]);

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
        flex: 1.2,
        valueGetter: (_value, row) => row.entityData?.name ?? row.entityId,
        renderCell: (params: GridRenderCellParams<ActivityLogEntry>) => (
          <GetEntityLink
            id={params.row.entityId}
            entityName={params.row.model}
            name={params.row.entityData?.name ?? params.row.entityId}
          />
        ),
      },
      {
        field: "model",
        headerName: "Type",
        flex: 1,
        valueGetter: (_value, row) => humanizeModel(row.model),
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
            <GetEntityLink
              id={creator.id}
              entityName="user"
              name={creator.displayName || creator.identifier}
            />
          );
        },
      },
      {
        field: "createdAt",
        headerName: "When",
        flex: 0.8,
        valueGetter: (_value, row) => new Date(row.createdAt).getTime(),
        renderCell: (params: GridRenderCellParams<ActivityLogEntry>) => (
          <RelativeTime date={params.row.createdAt} sx={{ display: "flex" }} />
        ),
      },
    ],
    [],
  );

  const handleRowClick = (params: { row: ActivityLogEntry }) => {
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
            Showing {displayedActivities.length} most recent{" "}
            {displayedActivities.length !== 1 ? "activities" : "activity"}{" "}
            {hasFavorites ? "on your favorites" : "across all resources"}
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
        ) : displayedActivities.length === 0 ? (
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
            rows={displayedActivities}
            columns={columns}
            autoHeight
            disableRowSelectionOnClick
            onRowClick={handleRowClick}
            {...dataGridDefaultProps}
            sx={{
              ...dataGridSx,
              ...dataGridClickableRowSx,
              border: "none",
              bgcolor: "background.paper",
            }}
          />
        )}
      </Box>
    </Box>
  );
};
