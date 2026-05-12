import { useCallback, useEffect, useMemo, useState } from "react";

import { Box, Card, CardContent } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  DataGrid,
  GridColDef,
  GridPaginationModel,
  GridSortModel,
} from "@mui/x-data-grid";

import { useConfig } from "../../../common";
import { LogEntity } from "../../../types";
import { LogActionButtons } from "../../LogsComponent/LogActionButtons";
import { LogsDialog } from "../../LogsComponent/LogsDialog";
import { RelativeTime } from "../RelativeTime";

export interface EntityLogsProps {
  entityId?: string;
  traceId?: string;
  sourceCodeLanguage?: string;
}

export const EntityLogs = ({
  entityId,
  traceId,
  sourceCodeLanguage,
}: EntityLogsProps) => {
  const { ikApi } = useConfig();

  const [logHeads, setLogHeads] = useState<LogEntity[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedLog, setSelectedLog] = useState<{
    executionStart: number;
    action: string;
    view: "summary" | "logs";
    entityId: string;
  } | null>(null);

  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: "created_at", sort: "desc" },
  ]);

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  const filter = useMemo(() => {
    const baseFilter: Record<string, any> = {
      level: "header",
    };
    if (traceId) {
      baseFilter.trace_id = traceId;
    }
    if (entityId) {
      baseFilter.entity_id = entityId;
    }
    return baseFilter;
  }, [entityId, traceId]);

  const fetchLogHeads = useCallback(() => {
    setLoading(true);
    ikApi
      .getList("logs", {
        filter,
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
  }, [ikApi, filter]);

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
        field: "revision",
        headerName: "Revision",
        flex: 0.2,
      },
      {
        field: "actions",
        headerName: "",
        flex: 0.5,
        sortable: false,
        renderCell: (params) => (
          <LogActionButtons
            action={"any"}
            sourceCodeLanguage={sourceCodeLanguage}
            onOpenSummary={() =>
              setSelectedLog({
                executionStart: params.row.execution_start,
                action: params.row.data,
                view: "summary",
                entityId: params.row.entity_id,
              })
            }
            onOpenLogs={() =>
              setSelectedLog({
                executionStart: params.row.execution_start,
                action: params.row.data,
                view: "logs",
                entityId: params.row.entity_id,
              })
            }
          />
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
        <LogsDialog
          entityId={selectedLog.entityId}
          action={selectedLog.action}
          view={selectedLog.view}
          executionStart={selectedLog.executionStart}
          onClose={() => setSelectedLog(null)}
          onViewChange={(view) =>
            setSelectedLog((prev) => (prev ? { ...prev, view } : null))
          }
        />
      )}
    </Box>
  );
};
