import { useCallback, useEffect, useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Box, Card, CardContent, IconButton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  DataGrid,
  GridColDef,
  GridPaginationModel,
  GridSortModel,
} from "@mui/x-data-grid";

import { CommonDialog, useConfig } from "../../../common";
import { LogEntity } from "../../../types";
import { RelativeTime } from "../RelativeTime";

import { LogsView } from "./LogsView";
import { SummaryView } from "./SummaryView";

export interface EntityLogsProps {
  entityId: string;
  sourceCodeLanguage?: string;
}

const isTerraformLanguage = (lang?: string): boolean =>
  lang === "opentofu" || lang === "terraform";

const getDialogTitle = (view: "summary" | "logs", action?: string): string => {
  if (view === "logs") return "Logs";

  switch (action) {
    case "dryrun":
    case "dryrun_with_temp_state":
      return "Plan Summary";
    case "execute":
      return "Apply Summary";
    default:
      return "Execution Summary";
  }
};

export const EntityLogs = ({
  entityId,
  sourceCodeLanguage,
}: EntityLogsProps) => {
  const { ikApi } = useConfig();

  const [logHeads, setLogHeads] = useState<LogEntity[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedLog, setSelectedLog] = useState<{
    executionStart: number;
    action: string;
    view: "summary" | "logs";
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: "created_at", sort: "desc" },
  ]);

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  const fetchLogHeads = useCallback(() => {
    setLoading(true);
    ikApi
      .getList("logs", {
        filter: { entity_id: entityId, level: "header" },
        pagination: { page: 1, perPage: 600 },
        sort: { field: "created_at", order: "DESC" },
      })
      .then((response) => {
        setLogHeads(response.data);
      })
      .catch(() => {
        setLogHeads([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ikApi, entityId]);

  useEffect(() => {
    fetchLogHeads();
  }, [fetchLogHeads]);

  const columns: GridColDef<LogEntity>[] = useMemo(
    () => [
      {
        field: "data",
        headerName: "Action",
        flex: 1,
        renderCell: (params) => (
          <Box
            sx={{
              fontWeight: 500,
              fontSize: "0.875rem",
            }}
          >
            {params.value}
          </Box>
        ),
      },
      {
        field: "created_at",
        headerName: "Started",
        flex: 0.2,
        renderCell: (params) => (
          <RelativeTime date={params.value} sx={{ fontSize: "0.75rem" }} />
        ),
      },
      {
        field: "actions",
        headerName: "",
        flex: 0.5,
        sortable: false,
        renderCell: (params) => (
          <Box
            sx={{
              display: "flex",
              gap: 1,
              alignItems: "center",
              height: "100%",
            }}
          >
            {params.row.data !== "sync" &&
              isTerraformLanguage(sourceCodeLanguage) && (
                <Tooltip title="Summary">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLog({
                        executionStart: params.row.execution_start,
                        action: params.row.data,
                        view: "summary",
                      });
                    }}
                  >
                    <AutoAwesomeIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            <Tooltip title="Logs">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLog({
                    executionStart: params.row.execution_start,
                    action: params.row.data,
                    view: "logs",
                  });
                }}
              >
                <Icon icon="ix:log" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [sourceCodeLanguage],
  );

  return (
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <DataGrid
              rows={logHeads}
              columns={columns}
              loading={loading}
              getRowId={(row) => row.id}
              pagination
              disableColumnFilter
              disableColumnMenu
              disableRowSelectionOnClick
              sortModel={sortModel}
              onSortModelChange={setSortModel}
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pageSizeOptions={[10, 25, 50, 100]}
              sx={{
                "& .MuiDataGrid-columnHeader": {
                  "& .MuiDataGrid-columnHeaderTitleContainer": {
                    justifyContent: "space-between",
                    flexDirection: "row",
                  },
                  "& .MuiButtonBase-root": {
                    border: "none",
                  },
                },
                "& .MuiTablePagination-root": {
                  "& .MuiButtonBase-root": {
                    border: "none",
                  },
                },
                "& .MuiDataGrid-row": {
                  "&:hover": {
                    backgroundColor: (theme) =>
                      alpha(theme.palette.primary.main, 0.08),
                  },
                },
              }}
            />
          </Box>
        </CardContent>
      </Card>
      {selectedLog && (
        <CommonDialog
          title={getDialogTitle(selectedLog.view, selectedLog.action)}
          maxWidth="md"
          hasFooterActions={false}
          open
          onClose={() => {
            setSelectedLog(null);
          }}
          headerAction={
            <Tooltip title="Refresh">
              <IconButton
                size="small"
                onClick={() => setRefreshKey((k) => k + 1)}
                aria-label="Refresh"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          }
          content={
            selectedLog.view === "summary" ? (
              <SummaryView
                entityId={entityId}
                executionStart={selectedLog.executionStart}
                eventAction={selectedLog.action}
                refreshKey={refreshKey}
                onOpenLogs={() =>
                  setSelectedLog((prev) =>
                    prev ? { ...prev, view: "logs" } : null,
                  )
                }
              />
            ) : (
              <LogsView
                entityId={entityId}
                executionTime={selectedLog.executionStart}
                scrollContainerId={`entityLogsScroll-${selectedLog.executionStart}`}
              />
            )
          }
        />
      )}
    </Box>
  );
};
